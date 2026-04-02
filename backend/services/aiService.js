const { getCollectorLocation, getAllCollectorLocations } = require('../src/socket/state');
const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');

// ── Models & Clients ───────────────────────────────────────────────────────────
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'MISSING_GROQ_KEY',
});

// gemini-1.5-flash: 15 RPM (free) vs 10 RPM for 1.5-pro
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ── Fallback Logic Helper ─────────────────────────────────────────────────────
/**
 * Generic AI caller with Groq primary and Gemini fallback
 */
async function getAIResponse(systemPrompt, userMessage, history = [], options = {}) {
    const { 
        jsonMode = false, 
        maxTokens = 800, 
        temperature = 0.7, 
        timeout = 8000, 
        retries = 1 
    } = options;

    const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...history
            .map(m => ({ 
                role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user', 
                content: typeof m.parts === 'object' && m.parts[0]?.text ? m.parts[0].text : (m.content || m.text || '')
            }))
            .filter(m => m.content && m.content.trim().length > 0), // Groq returns 422 on empty content
        { role: 'user', content: userMessage }
    ];

    // Try Groq (Primary)
    let lastError = null;
    for (let i = 0; i <= retries; i++) {
        try {
            console.log(`[AI] Attempt ${i + 1}: Calling Groq (${GROQ_MODEL})...`);
            
            const groqOptions = {
                model: GROQ_MODEL,
                messages: groqMessages,
                temperature,
                max_tokens: maxTokens,
                response_format: jsonMode ? { type: 'json_object' } : undefined,
            };

            const response = await Promise.race([
                groq.chat.completions.create(groqOptions),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Groq Timeout')), timeout))
            ]);

            const content = response.choices[0]?.message?.content;
            if (content) {
                console.log(`[AI] Success: Groq responded on attempt ${i + 1}`);
                return { 
                    message: content, 
                    source: 'groq', 
                    status: 'success',
                    model: GROQ_MODEL 
                };
            }
        } catch (error) {
            lastError = error;
            // Print full Groq error body for debugging (422 often has a descriptive reason)
            console.warn(`[AI] Groq failed (attempt ${i + 1}) [status=${error.status}]:`, error.message || error);
            if (error.error) console.warn('[AI] Groq error detail:', JSON.stringify(error.error));
            if (error.status === 401 || error.status === 403 || error.status === 422) break; // Don't retry auth or unprocessable errors
        }
    }

    // Try Gemini (Fallback)
    console.log(`[AI] Fallback: Switching to Gemini (${GEMINI_MODEL})`);
    try {
        // Transform history for Gemini format
        const geminiContents = history.map(m => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: typeof m.parts === 'object' && m.parts[0]?.text ? m.parts[0].text : (m.content || m.text || '') }]
        }));
        
        geminiContents.push({ role: 'user', parts: [{ text: userMessage }] });

        const model = ai.getGenerativeModel({ 
            model: GEMINI_MODEL,
            systemInstruction: systemPrompt 
        });

        const result = await model.generateContent({
            contents: geminiContents,
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature,
                responseMimeType: jsonMode ? 'application/json' : 'text/plain',
            }
        });

        const content = result.response.text();
        return { 
            message: content, 
            source: 'gemini', 
            status: 'success',
            model: GEMINI_MODEL 
        };
    } catch (error) {
        console.error(`[AI] Critical failure: All models failed.`, error);
        return { 
            message: "🌱 **I'm taking a quick breather!** My AI systems are temporarily unavailable due to high demand. Please try again shortly.",
            source: 'none',
            status: 'error',
            error: error.message
        };
    }
}

async function chatWithAI(userMessage, context = {}) {
    const baseSystemPrompt = "You are an eco-friendly AI assistant helping users reuse, recycle, barter, and reduce waste. You can also help schedule waste pickups by understanding natural language requests like 'Schedule pickup tomorrow for plastic'. You can provide live tracking information for collectors. Provide practical, actionable, and sustainable suggestions. When users ask about pickups, encourage them to use natural language and you'll handle the scheduling automatically. For tracking questions, let them know you can provide real-time location updates.\n\nIMPORTANT: Respond ONLY in the user's preferred language (en, hi, kn). Do not switch languages.\n\nIMPORTANT: Do NOT translate item names, user names, or any user-generated content verbatim. If you must refer to an item title provided by the user, keep it exactly as written (preserve spelling/case), and do not \"correct\" it.";

    const languagePrompts = {
        en: `${baseSystemPrompt}\n\nThe user's preferred language is English. You MUST reply ONLY in English.`,
        hi: `${baseSystemPrompt}\n\nIMPORTANT: The user is writing to you in Hindi. You MUST reply ONLY in Hindi (हिंदी). Do NOT switch to English under any circumstances. Use simple, everyday Hindi that is easy to understand. Use relevant Hindi terms for waste management, recycling, and sustainability.`,
        kn: `${baseSystemPrompt}\n\nIMPORTANT: The user is writing to you in Kannada. You MUST reply ONLY in Kannada (ಕನ್ನಡ). Do NOT switch to English under any circumstances. Use simple, everyday Kannada that is easy to understand. Use relevant Kannada terms for waste management, recycling, and sustainability.`
    };

    const supportedLanguages = ['en', 'hi', 'kn'];
    const lang = supportedLanguages.includes(context.language) ? context.language : 'en';
    let systemPrompt = languagePrompts[lang];

    if (context.platformKnowledge) {
        systemPrompt += `\n\n${context.platformKnowledge}`;
    }

    if (context.userInfo) {
        systemPrompt += `\n\nUser context: ${JSON.stringify(context.userInfo)}`;
    }

    // Optimization: Trim history if it's too long (though controller already does this, we ensure it here)
    const history = (context.history || []).slice(-10);

    const result = await getAIResponse(systemPrompt, userMessage, history, {
        maxTokens: 500,
        temperature: 0.7,
        timeout: 10000, // 10s for chat
        retries: 1
    });

    const aiResponse = result.message;

    // Update history for future calls (mutate context if passed)
    if (context.history && result.status === 'success') {
        context.history.push({ role: 'user', content: userMessage });
        context.history.push({ role: 'assistant', content: aiResponse });
    }

    return {
        response: aiResponse,
        message: aiResponse,
        source: result.source,
        status: result.status,
        model: result.model
    };
}

/**
 * Generate barter suggestions using AI
 */
async function generateBarterSuggestions(userItems, marketplaceItems, userContext = {}) {
    const systemPrompt = `You are an eco-friendly barter assistant. Analyze the user's items and available marketplace items to suggest meaningful barter opportunities.

Consider:
- Item categories and compatibility
- Fair credit value exchanges
- Eco-friendly barter benefits
- Practical usefulness of items

Provide 2-3 specific barter suggestions.
Format your response as a JSON object with this structure:
{
  "suggestions": [
    {
      "userItem": "item name",
      "marketplaceItem": "item name",
      "creditAdjustment": 10,
      "reasoning": "brief explanation"
    }
  ],
  "summary": "overall recommendation"
}`;

    const userItemsText = userItems.map(item =>
        `- ${item.title}: ${item.description} (Category: ${item.category}, Value: ${item.price} credits)`
    ).join('\n');

    const marketplaceItemsText = marketplaceItems.slice(0, 10).map(item =>
        `- ${item.title}: ${item.description} (Category: ${item.category}, Value: ${item.price} credits, Seller: ${item.seller?.name || 'Unknown'})`
    ).join('\n');

    const userMessage = `My items:\n${userItemsText}\n\nAvailable marketplace items:\n${marketplaceItemsText}\n\nUser context: Eco score ${userContext.ecoScore || 0}, Wallet credits: ${userContext.walletCredits || 0}`;

    const result = await getAIResponse(systemPrompt, userMessage, [], {
        jsonMode: true,
        maxTokens: 800,
        temperature: 0.7
    });

    try {
        return {
            ...JSON.parse(result.message),
            source: result.source,
            status: result.status
        };
    } catch {
        return {
            suggestions: [],
            summary: result.message,
            source: result.source,
            status: result.status
        };
    }
}

/**
 * Classify waste from image using AI vision
 */
async function classifyWasteFromImage(imageUrl) {
    const systemPrompt = `You are an expert waste classification AI. Analyze the image and classify the waste material.

Return a JSON object with this exact structure:
{
  "wasteType": "plastic|metal|organic|e-waste|paper|glass|other",
  "confidence": 0.95,
  "disposalInstructions": "Specific instructions for disposal/recycling",
  "ecoImpact": "Brief explanation of environmental impact",
  "recyclingPotential": "high|medium|low",
  "pickupRecommendation": "Schedule pickup now|Recycle at center|Compost at home|etc"
}

Be precise and helpful. Focus on sustainable disposal methods.`;

    try {
        const imageResp = await fetch(imageUrl);
        const arrayBuffer = await imageResp.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imageResp.headers.get('content-type') || 'image/jpeg';

        const model = ai.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent([
            { text: systemPrompt },
            { inlineData: { mimeType, data: base64Data } }
        ]);

        const aiResponse = result.response.text();

        try {
            const classification = JSON.parse(aiResponse);
            return {
                ...classification,
                imageUrl,
                source: 'gemini',
                timestamp: new Date().toISOString()
            };
        } catch (parseError) {
            return {
                wasteType: 'unknown',
                confidence: 0.5,
                disposalInstructions: aiResponse || 'Unable to classify waste type',
                ecoImpact: 'Classification uncertain',
                recyclingPotential: 'unknown',
                pickupRecommendation: 'Please try uploading a clearer image',
                imageUrl,
                source: 'gemini',
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error('Gemini API error (vision):', error);
        return {
            wasteType: 'unknown',
            confidence: 0,
            disposalInstructions: "AI classification currently unavailable. Please try again later.",
            ecoImpact: 'Unknown due to server load',
            recyclingPotential: 'unknown',
            pickupRecommendation: 'Please wait, our servers are cooling down.',
            imageUrl,
            source: 'none',
            status: 'error',
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Parse natural language pickup request.
 *
 * Uses regex/keyword heuristics — NO Gemini API call.
 * This saves 1 RPM per chat message, which is critical on free-tier limits.
 */
function parsePickupRequest(message) {
    const lower = message.toLowerCase();

    // Must contain a scheduling intent keyword
    const intentKeywords = [
        'schedule', 'pickup', 'pick up', 'collect', 'book', 'request pickup',
        'arrange pickup', 'set up pickup', 'i need pickup', 'please pick',
    ];
    const hasIntent = intentKeywords.some(k => lower.includes(k));
    if (!hasIntent) return { isPickupRequest: false };

    // Waste type detection
    const wasteMap = {
        plastic:  ['plastic', 'bottle', 'container', 'polythene', 'bag'],
        metal:    ['metal', 'iron', 'steel', 'aluminum', 'aluminium', 'tin', 'can'],
        ewaste:   ['ewaste', 'e-waste', 'electronic', 'electronics', 'phone', 'laptop', 'computer', 'battery'],
        paper:    ['paper', 'cardboard', 'newspaper', 'book', 'magazine'],
        glass:    ['glass', 'bottle', 'jar'],
        organic:  ['organic', 'food', 'vegetable', 'fruit', 'compost'],
    };
    let wasteType = null;
    for (const [type, keywords] of Object.entries(wasteMap)) {
        if (keywords.some(k => lower.includes(k))) { wasteType = type; break; }
    }

    // Date detection
    let date = null;
    if (lower.includes('tomorrow')) date = 'tomorrow';
    else if (lower.includes('today')) date = 'today';

    // Time slot detection
    let timeSlot = 'morning';
    if (lower.includes('afternoon')) timeSlot = 'afternoon';
    else if (lower.includes('evening') || lower.includes('night')) timeSlot = 'evening';

    // Quantity detection (simple number extraction)
    const qtyMatch = lower.match(/(\d+)\s*(kg|kilogram|kilo)/i);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

    // Urgency
    const urgency = lower.includes('urgent') || lower.includes('asap') || lower.includes('immediately')
        ? 'urgent'
        : 'normal';

    return { isPickupRequest: true, wasteType, quantity, date, timeSlot, urgency };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Estimate ETA based on distance
 */
function estimateETA(distanceKm) {
    const avgSpeedKmh = 30; // Average city speed
    const timeHours = distanceKm / avgSpeedKmh;
    const timeMinutes = Math.round(timeHours * 60);

    if (timeMinutes < 1) {
        return { minutes: 1, text: 'less than 1 minute' };
    } else if (timeMinutes < 60) {
        return { minutes: timeMinutes, text: `${timeMinutes} minute${timeMinutes > 1 ? 's' : ''}` };
    } else {
        const hours = Math.floor(timeMinutes / 60);
        const remainingMinutes = timeMinutes % 60;
        return {
            minutes: timeMinutes,
            text: `${hours} hour${hours > 1 ? 's' : ''}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}` : ''}`
        };
    }
}

/**
 * Parse tracking queries and provide collector location info
 */
async function parseTrackingQuery(message, userId) {
    const trackingKeywords = ['where', 'location', 'collector', 'pickup', 'arriving', 'coming', 'distance', 'eta', 'time'];
    const isTrackingQuery = trackingKeywords.some(keyword =>
        message.toLowerCase().includes(keyword)
    );

    if (!isTrackingQuery) return null;

    try {
        const allLocations = getAllCollectorLocations();

        if (allLocations.length === 0) {
            return {
                found: false,
                message: "No collectors are currently online. Please try again later."
            };
        }

        const userLocation = { lat: 12.9716, lng: 77.5946 };

        let nearestCollector = null;
        let minDistance = Infinity;

        for (const location of allLocations) {
            const distance = calculateDistance(userLocation, {
                lat: location.lat,
                lng: location.lng
            });

            if (distance < minDistance) {
                minDistance = distance;
                nearestCollector = location;
            }
        }

        if (!nearestCollector) {
            return { found: false, message: "Unable to locate your collector at the moment." };
        }

        const eta = estimateETA(minDistance);

        return {
            found: true,
            distance: Math.round(minDistance * 10) / 10,
            eta: eta,
            collectorId: nearestCollector.collectorId,
            lastUpdated: nearestCollector.updatedAt,
            message: `Your collector is ${minDistance.toFixed(1)} km away and will arrive in ${eta.text}.`
        };

    } catch (error) {
        console.error('Tracking query error:', error);
        return {
            found: false,
            message: "Sorry, I couldn't retrieve tracking information right now."
        };
    }
}

/**
 * Generate quick reply suggestions.
 *
 * Uses keyword-based heuristics first — NO Gemini API call.
 * This saves 1 RPM per chat message, critical on free-tier limits.
 * Falls back to a generic set so the UI always has options.
 */
function suggestQuickReplies(conversationHistory = [], lastMessage = '') {
    const lower = (lastMessage || '').toLowerCase();

    // Topic-aware quick replies based on the last message content
    if (lower.includes('recycle') || lower.includes('recycl')) {
        return ['How do I sort waste?', 'Schedule a pickup', 'Recycling centers nearby', 'Eco score tips'];
    }
    if (lower.includes('pickup') || lower.includes('collect') || lower.includes('schedule')) {
        return ['Schedule for tomorrow', 'Track my collector', 'Change pickup time', 'Cancel pickup'];
    }
    if (lower.includes('barter') || lower.includes('trade') || lower.includes('exchange')) {
        return ['Show barter suggestions', 'List my items', 'How does bartering work?', 'Eco tips'];
    }
    if (lower.includes('eco') || lower.includes('score') || lower.includes('point')) {
        return ['How to earn more points?', 'My eco stats', 'Top recyclers', 'Weekly challenges'];
    }
    if (lower.includes('track') || lower.includes('where') || lower.includes('location')) {
        return ['Track my collector', 'ETA for pickup', 'Contact collector', 'Reschedule pickup'];
    }
    if (lower.includes('plastic') || lower.includes('metal') || lower.includes('paper') || lower.includes('glass')) {
        return ['Schedule pickup', 'Proper disposal tips', 'Nearest center', 'Book collection'];
    }

    // Generic default
    return ['Schedule a pickup', 'Eco tips', 'Check my score', 'How to recycle?'];
}

/**
 * Detect if a message is spam or inappropriate.
 *
 * Uses regex/heuristics — NO Gemini API call.
 * This saves 1 RPM per chat message, critical on free-tier limits.
 * Covers the most common abuse patterns while maintaining O(1) latency.
 */
function detectSpam(message, recentMessages = []) {
    const text    = (message || '').trim();
    const lower   = text.toLowerCase();
    const reasons = [];

    // 1. Empty / too short
    if (text.length < 2) {
        return { isSpam: true, confidence: 0.9, reasons: ['Message too short'], severity: 'low' };
    }

    // 2. Excessive length (> 2000 chars — well above the validator limit, belt-and-suspenders)
    if (text.length > 2000) {
        reasons.push('Message too long');
    }

    // 3. Profanity / slur list (extend as needed)
    const badWords = ['fuck', 'shit', 'asshole', 'bastard', 'bitch', 'cunt', 'dick', 'nigger', 'faggot'];
    if (badWords.some(w => lower.includes(w))) {
        reasons.push('Contains inappropriate language');
    }

    // 4. Repetition: same message sent more than 3 times recently
    const recentContents = recentMessages.slice(-10).map(m => (m.content || '').toLowerCase().trim());
    const duplicates = recentContents.filter(c => c === lower).length;
    if (duplicates >= 3) {
        reasons.push('Repeated identical messages');
    }

    // 5. All-caps shouting (> 70 % uppercase, length > 10)
    if (text.length > 10) {
        const upperCount = (text.match(/[A-Z]/g) || []).length;
        const letterCount = (text.match(/[A-Za-z]/g) || []).length;
        if (letterCount > 0 && upperCount / letterCount > 0.7) {
            reasons.push('Excessive capitalisation');
        }
    }

    // 6. Spam URLs / promotional patterns
    if (/(https?:\/\/)|(www\.)/i.test(text) && !lower.includes('recycle') && !lower.includes('pickup')) {
        reasons.push('Suspicious URL detected');
    }

    if (reasons.length === 0) {
        return { isSpam: false, confidence: 0, reasons: [], severity: 'low' };
    }

    const confidence = Math.min(0.4 * reasons.length, 0.95);
    const severity   = reasons.length >= 3 ? 'high' : reasons.length === 2 ? 'medium' : 'low';
    return { isSpam: true, confidence, reasons, severity };
}

/**
 * Translate a message to another language
 */
async function translateMessage(message, targetLanguage, sourceLanguage = 'auto') {
    const systemPrompt = `You are a professional translator specializing in eco-friendly topics. Return JSON:
{
  "translatedText": "the translation",
  "detectedSourceLanguage": "language code",
  "targetLanguage": "language code",
  "confidence": number (0-1)
}`;

    const userMessage = `Translate this message to ${targetLanguage} (source language: ${sourceLanguage}):\n\n"${message}"`;

    const result = await getAIResponse(systemPrompt, userMessage, [], {
        jsonMode: true,
        maxTokens: 500,
        temperature: 0.3
    });

    try {
        const parsed = JSON.parse(result.message);
        return {
            translatedText: parsed.translatedText || message,
            detectedSourceLanguage: parsed.detectedSourceLanguage || 'en',
            targetLanguage: targetLanguage,
            confidence: parsed.confidence || 0.9,
            source: result.source
        };
    } catch {
        return { 
            translatedText: message, 
            detectedSourceLanguage: 'en', 
            targetLanguage: targetLanguage, 
            confidence: 0.5,
            source: result.source
        };
    }
}

/**
 * Analyze user eco activities and suggest personalized improvements
 */
async function analyzeEcoActivities(userStats, recentActivities = []) {
    const systemPrompt = `You are an eco-friendly AI analyst. Analyze the user's environmental impact and provide personalized suggestions for improvement.
Return a JSON object with:
{
  "currentLevel": "beginner|intermediate|advanced|expert",
  "insights": ["3-4 key insights about their eco impact"],
  "suggestions": [
    {
      "action": "specific actionable suggestion",
      "impact": "expected eco benefit",
      "difficulty": "easy|medium|hard",
      "points": 20
    }
  ],
  "nextMilestone": "next achievement goal",
  "weeklyGoal": "suggested weekly target"
}`;

    const userMessage = `Analyze my eco activities and suggest improvements. Here are my stats:
Eco Score: ${userStats.ecoScore || 0}
CO2 Saved: ${userStats.co2SavedKg || 0} kg
Waste Recycled: ${userStats.wasteRecycledKg || 0} kg
Items Reused: ${userStats.itemsReusedCount || 0}
Credits: ${userStats.credits || 0}

Recent activities:
${recentActivities.slice(-10).map(activity => `- ${activity.type}: ${activity.description}`).join('\n')}

What can I do to improve my eco impact?`;

    const result = await getAIResponse(systemPrompt, userMessage, [], {
        jsonMode: true,
        maxTokens: 800,
        temperature: 0.7
    });

    try {
        const analysis = JSON.parse(result.message);
        return {
            ...analysis,
            source: result.source,
            timestamp: new Date().toISOString()
        };
    } catch {
        return {
            currentLevel: 'beginner',
            insights: ['Keep up your eco-friendly activities!'],
            suggestions: [{ action: 'Recycle more items to gain points', impact: 'Reduce waste', difficulty: 'easy', points: 10 }],
            source: result.source,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = { chatWithAI, generateBarterSuggestions, classifyWasteFromImage, parsePickupRequest, parseTrackingQuery, suggestQuickReplies, detectSpam, translateMessage, analyzeEcoActivities };