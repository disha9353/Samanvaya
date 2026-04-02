/**
 * aiController.js  (v2 – Intelligent Agent Edition)
 *
 * Architecture: Intent → Tool Dispatch → Gemini (only if needed)
 *
 * Intent layers (all synchronous, zero extra Gemini calls):
 *  1. spam check          → heuristics
 *  2. intent detection    → keyword map → routes to tool or Gemini
 *  3. tool dispatch       → searchItems / getCampaigns / getReports / createPickup
 *  4. Gemini (agent mode) → ONLY when no tool can answer fully
 *
 * Token / credit optimisations kept from v1:
 *  - detectSpam / parsePickupRequest / suggestQuickReplies remain sync
 *  - Cache on (message, language) key — 5-min TTL for generic queries
 *  - History trimmed to last 6 exchanges (12 messages) before sending
 */

const {
    chatWithAI,
    generateBarterSuggestions,
    classifyWasteFromImage,
    parsePickupRequest,
    parseTrackingQuery,
    suggestQuickReplies,
    detectSpam,
    translateMessage,
    analyzeEcoActivities,
} = require('../../services/aiService');

const WasteRequest      = require('../models/WasteRequest');
const mediaService      = require('../modules/media/mediaService');
const User              = require('../models/User');
const Item              = require('../models/Item');
const Campaign          = require('../models/Campaign');
const PickupTransaction = require('../models/PickupTransaction');
const BarterRequest     = require('../models/BarterRequest');
const wasteService      = require('../modules/waste/wasteService');
const { ApiError }      = require('../utils/ApiError');
const { aiCache, DEFAULTS } = require('../utils/aiCache');

// ─────────────────────────────────────────────────────────────────────────────
// Platform knowledge injected into every Gemini system prompt
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORM_KNOWLEDGE = `
You are EcoBot – an intelligent AI assistant for the EcoBarter platform.

=== PLATFORM OVERVIEW ===
EcoBarter is a community sustainability platform where users can:
• LIST & BARTER ITEMS — post reusable goods (electronics, books, clothes, etc.) and exchange them with others using eco-credits instead of money
• EARN ECO-CREDITS — credits are earned by: bartering items, completing waste pickups, joining volunteer campaigns, and reporting pollution
• WASTE PICKUP — schedule a doorstep collection for plastic, metal, e-waste, glass, organic, or paper waste; a certified collector arrives and earns credits for completing the pickup
• CAMPAIGNS — volunteer for eco drives (tree planting, beach clean-ups, etc.) to earn credits per hour
• REPORTS — report ocean pollution, illegal dumping, or any environmental hazard with a photo and GPS location
• MAP VIEW — see all listed items and campaigns plotted on a live map
• DASHBOARD — track eco-score, credits balance, barter requests, and past pickups
• PROFILE — manage listings, view activity history

=== NAVIGATION GUIDE ===
/feed         → Browse & search marketplace items
/items/new    → Create a new listing
/campaigns    → View and join eco campaigns
/waste        → Schedule a waste pickup
/reports      → Report pollution / environmental issue
/reports/new  → Submit a new report
/dashboard    → Personal dashboard
/profile      → Your profile
/wallet       → Credit balance & transactions
/chat         → AI chat (you are here)

=== CREDITS SYSTEM ===
Earn credits by:
  - Listing & successfully bartering an item (+credits)
  - Completing a waste pickup as seller (+credits based on weight × price/kg)
  - Joining & attending a campaign (+creditsPerHour × durationHours)
  - Reporting verified pollution (+bonus credits)

Spend credits by:
  - Requesting items listed at a credit price

=== HOW TO HELP USERS ===
• If user asks to SEARCH for an item → I will search the database and show results
• If user asks to BOOK a PICKUP → I will collect: waste type, quantity, date, time slot, then create it
• If user asks about CAMPAIGNS → I will fetch live campaign data
• If user wants to REPORT pollution → guide them to /reports/new
• For general eco questions → answer from your knowledge about sustainability/recycling

Always be conversational, warm, and eco-conscious. Prefer real data over generated answers.
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolvePickupDate(parsed) {
    const d = new Date();
    if (parsed.date === 'tomorrow') d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

const TIME_SLOT_MAP = {
    morning:   '09:00-12:00',
    afternoon: '14:00-17:00',
    evening:   '18:00-21:00',
};

// ─────────────────────────────────────────────────────────────────────────────
// Intent Detection (synchronous, zero Gemini calls)
// ─────────────────────────────────────────────────────────────────────────────

const INTENTS = {
    SEARCH_ITEMS:    ['find item', 'search item', 'looking for', 'do you have', 'is there any', 'show me items', 'any items', 'find me', 'available item', 'show items', 'list items'],
    GET_CAMPAIGNS:   ['campaign', 'volunteer', 'eco drive', 'event', 'campaigns available', 'join campaign', 'upcoming event'],
    GET_REPORTS:     ['reports', 'pollution report', 'show reports', 'recent reports', 'report status'],
    BOOK_PICKUP:     ['schedule pickup', 'book pickup', 'pick up', 'arrange pickup', 'request pickup', 'i need a pickup', 'collect my waste', 'schedule a collection'],
    PLATFORM_HELP:   ['how to earn', 'earn credits', 'how does', 'what is this', 'how to use', 'guide me', 'help me', 'what can i do', 'features', 'navigate', 'how to report', 'how to barter'],
    CHECK_CREDITS:   ['my credits', 'my balance', 'how many credits', 'wallet balance', 'eco score', 'my score'],
};

function detectIntent(message) {
    const lower = message.toLowerCase();
    for (const [intent, keywords] of Object.entries(INTENTS)) {
        if (keywords.some(k => lower.includes(k))) return intent;
    }
    return 'GENERAL';
}

// Extract a search query from natural language
function extractSearchQuery(message) {
    const lower = message.toLowerCase();
    // Remove common filler phrases to isolate the item name
    const cleaners = [
        'find item', 'search item', 'looking for', 'do you have', 'is there any',
        'show me', 'any items', 'find me', 'available item', 'i need', 'i want',
        'can i find', 'are there', 'show items for', 'search for', 'find',
    ];
    let q = lower;
    for (const c of cleaners) q = q.replace(c, '');
    return q.replace(/[?!.,]/g, '').trim() || message.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Functions (callable by the agent)
// ─────────────────────────────────────────────────────────────────────────────

async function toolSearchItems(query, limit = 8) {
    const items = await Item.find({
        status: 'Available',
        title: { $regex: query, $options: 'i' }
    })
        .limit(limit)
        .select('title description category price images location seller')
        .populate('seller', 'name');

    if (items.length === 0) {
        return { found: false, message: `No items found for "${query}". Try a different keyword.` };
    }

    const lines = items.map((it, i) => {
        const seller = typeof it.seller === 'object' ? it.seller.name : 'Unknown';
        const hasLocation = it.location?.coordinates?.[0] !== 0;
        return `${i + 1}. **${it.title}** — ${it.price} 🪙 credits\n   Category: ${it.category} | Seller: ${seller}${hasLocation ? ' | 📍 Located' : ''}\n   ${it.description ? it.description.substring(0, 80) + (it.description.length > 80 ? '…' : '') : ''}`;
    });

    return {
        found: true,
        count: items.length,
        message: `Found **${items.length} item${items.length > 1 ? 's' : ''}** matching "${query}":\n\n${lines.join('\n\n')}\n\n👉 Go to [/feed](/feed) to browse and interact with these listings.`,
        items,
    };
}

async function toolGetCampaigns(limit = 6) {
    const campaigns = await Campaign.find({ status: { $in: ['OPEN', 'FULL'] } })
        .limit(limit)
        .select('title description location status creditsPerHour durationHours maxParticipants participants dateTime');

    if (campaigns.length === 0) {
        return { found: false, message: 'No active campaigns right now. Check back soon! 🌱' };
    }

    const lines = campaigns.map((c, i) => {
        const spots = c.maxParticipants > 0 ? `${c.maxParticipants - (c.participants?.length || 0)} spots left` : 'Open';
        const credits = c.creditsPerHour && c.durationHours ? `${c.creditsPerHour * c.durationHours} credits` : 'Credits available';
        const date = c.dateTime ? new Date(c.dateTime).toLocaleDateString() : 'Date TBD';
        return `${i + 1}. **${c.title}** [${c.status}]\n   📍 ${c.location || 'Location TBD'} | 📅 ${date}\n   💰 Earn: ${credits} | 👥 ${spots}`;
    });

    return {
        found: true,
        count: campaigns.length,
        message: `Here are **${campaigns.length} active campaign${campaigns.length > 1 ? 's' : ''}**:\n\n${lines.join('\n\n')}\n\n👉 Visit [/campaigns](/campaigns) to join any campaign.`,
        campaigns,
    };
}

async function toolGetUserStats(userId) {
    const user = await User.findById(userId).select('ecoScore credits');
    if (!user) return { message: 'Unable to fetch your stats right now.' };
    return {
        message: `📊 **Your Stats**\n\n🌿 Eco Score: **${user.ecoScore || 0}**\n💰 Credits: **${user.credits || 0}**\n\nKeep bartering and recycling to grow your score! 🚀`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-step pickup state (in-memory per session, cleared on clearChat)
// For production, move to Redis / DB session
// ─────────────────────────────────────────────────────────────────────────────

const pickupSessions = new Map(); // userId → { step, data }

const PICKUP_STEPS = ['wasteType', 'quantity', 'date', 'timeSlot'];

function getPickupSession(userId) {
    return pickupSessions.get(String(userId)) || null;
}

function setPickupSession(userId, session) {
    if (session === null) {
        pickupSessions.delete(String(userId));
    } else {
        pickupSessions.set(String(userId), session);
        // Auto-expire after 10 minutes
        setTimeout(() => pickupSessions.delete(String(userId)), 10 * 60 * 1000);
    }
}

const PICKUP_PROMPTS = {
    wasteType:
        '👉 What type of waste do you want to schedule for pickup?',
    quantity:
        '👉 Enter the quantity of waste (in kg or units)',
    locationPermission:
        '👉 Can I access your location to schedule pickup accurately?',
    manualLocation:
        '👉 Please enter your location manually:',
    dateTime:
        '👉 Please select a date and time for pickup',
    confirm: (data) =>
        `✅ **Confirm your pickup request:**\n\n♻️ Waste type: **${data.wasteType}**\n📦 Quantity: **${data.quantity} kg**\n📅 Date: **${data.pickupDate}**\n⏰ Time: **${data.pickupTime}**\n\nReply **"yes"** to confirm or **"cancel"** to abort.`,
};

function parseWasteTypeFromMessage(msg) {
    const lower = msg.toLowerCase();
    const map = {
        plastic: ['plastic', 'bottle', 'polythene', 'bag'],
        metal: ['metal', 'iron', 'steel', 'aluminum', 'tin', 'can'],
        glass: ['glass', 'jar'],
        organic: ['organic', 'food', 'vegetable', 'compost'],
        others: ['others', 'other', 'ewaste', 'e-waste', 'electronic', 'paper', 'cardboard']
    };
    for (const [type, kws] of Object.entries(map)) {
        if (kws.some(k => lower.includes(k))) return type;
    }
    return msg.trim().split(/\s+/)[0].toLowerCase() || 'others';
}

function parseDateFromMessage(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('tomorrow')) return 'tomorrow';
    const d = new Date();
    if (lower.includes('today')) return d.toISOString().split('T')[0];
    // Try to parse "April 5" style
    const parsed = new Date(msg);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return 'today';
}

function parseTimeSlotFromMessage(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('afternoon')) return 'afternoon';
    if (lower.includes('evening') || lower.includes('night')) return 'evening';
    return 'morning';
}

function parseQuantityFromMessage(msg) {
    const match = msg.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : 1;
}

async function handlePickupFlow(userId, message, session) {
    const lower = message.toLowerCase().trim();

    // Cancel at any step
    if (lower === 'cancel' || lower === 'abort' || lower === 'stop') {
        setPickupSession(userId, null);
        return { response: '❌ Pickup booking cancelled. Let me know if you need anything else!', quickReplies: ['Schedule a pickup', 'Browse items', 'Eco tips'] };
    }

    // Collect each step
    if (session.step === 'wasteType') {
        session.data.wasteType = parseWasteTypeFromMessage(message);
        session.step = 'quantity';
        setPickupSession(userId, session);
        return { response: PICKUP_PROMPTS.quantity, quickReplies: ['1 kg', '2 kg', '5 kg', '10 kg'] };
    }

    if (session.step === 'quantity') {
        session.data.quantity = parseQuantityFromMessage(message);
        session.step = 'locationPermission';
        setPickupSession(userId, session);
        return { response: PICKUP_PROMPTS.locationPermission, quickReplies: ['Yes, use my location', 'No, type manually'] };
    }

    if (session.step === 'locationPermission') {
        if (message.startsWith('[Location]')) {
            const parts = message.replace('[Location]', '').split(',');
            session.data.location = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
            session.data.address = 'User location (auto-detected)';
            session.step = 'dateTime';
            setPickupSession(userId, session);
            return { response: PICKUP_PROMPTS.dateTime, quickReplies: [] };
        } else if (lower === 'no' || lower === 'no, type manually' || lower === 'deny' || message === '[Location Denied]') {
            session.step = 'manualLocation';
            setPickupSession(userId, session);
            return { response: PICKUP_PROMPTS.manualLocation, quickReplies: [] };
        } else if (lower === 'yes' || lower === 'yes, use my location' || lower === 'sure') {
            return { response: "Please click the 'Yes, use my location' button so I can securely fetch your coordinates, or reply 'No' to type it.", quickReplies: ['Yes, use my location', 'No, type manually'] };
        } else {
            session.data.address = message;
            session.data.location = { lat: 12.9716, lng: 77.5946 }; // Default fallback for manually typed location so map doesn't crash
            session.step = 'dateTime';
            setPickupSession(userId, session);
            return { response: PICKUP_PROMPTS.dateTime, quickReplies: [] };
        }
    }

    if (session.step === 'manualLocation') {
        session.data.address = message;
        session.data.location = { lat: 12.9716, lng: 77.5946 }; // Default fallback for manually typed location
        session.step = 'dateTime';
        setPickupSession(userId, session);
        return { response: PICKUP_PROMPTS.dateTime, quickReplies: [] };
    }

    if (session.step === 'dateTime') {
        if (message.startsWith('[DateTime]')) {
            const parts = message.replace('[DateTime]', '').trim().split('||');
            session.data.pickupDate = parts[0];
            session.data.pickupTime = parts[1];
        } else {
            // Manual fallback if they somehow bypass the picker
            session.data.pickupDate = 'Today';
            session.data.pickupTime = message;
        }
        
        session.step = 'confirm';
        setPickupSession(userId, session);
        return { response: PICKUP_PROMPTS.confirm(session.data), quickReplies: ['Yes', 'Cancel'] };
    }

    if (session.step === 'confirm') {
        if (lower === 'yes' || lower === 'confirm' || lower === 'ok' || lower === 'sure') {
            // Create the pickup
            try {
                const dateString = session.data.pickupDate || 'Today';
                const timeSlot = session.data.pickupTime || 'Morning';
                
                // Constructing the payload based on exact specification
                const payload = {
                    userId,
                    wasteType: session.data.wasteType,
                    quantity: session.data.quantity,
                    latitude: session.data.location?.lat || 12.9716,
                    longitude: session.data.location?.lng || 77.5946,
                    pickupDate: dateString,
                    pickupTime: timeSlot
                };

                const wasteRequest = await createPickupRequest(payload);



                setPickupSession(userId, null);
                return {
                    response: `👉 Your pickup request has been submitted successfully!\n\n♻️ Type: **${session.data.wasteType}**\n📦 Quantity: **${session.data.quantity} kg**\n📅 Date: **${dateString}**\n⏰ Slot: **${timeSlot}**\n\nRequest ID: \`${wasteRequest._id}\`\n\nA certified collector will contact you soon. You can track this from your [Dashboard](/dashboard). 🌱`,
                    pickupCreated: wasteRequest._id,
                    quickReplies: ['Track pickup', 'Schedule another', 'Browse items'],
                };
            } catch (err) {
                console.error('Pickup creation error:', err);
                setPickupSession(userId, null);
                return {
                    response: '❌ Sorry, I couldn\'t create the pickup right now. Please try the [Waste Pickup page](/waste) directly.',
                    quickReplies: ['Try again', 'Browse items'],
                };
            }
        } else {
            // Re-show confirmation
            return { response: PICKUP_PROMPTS.confirm(session.data), quickReplies: ['Yes', 'Cancel'] };
        }
    }

    return null; // Should not reach here
}

// ─────────────────────────────────────────────────────────────────────────────
// Main chat handler
// ─────────────────────────────────────────────────────────────────────────────

async function chat(req, res) {
    const { message, history = [], language = 'en' } = req.body;
    const userId = req.user._id;

    // ── 1. Spam check ────────────────────────────────────────────────────────
    const recentMessages = history.slice(-10).map(h => ({ content: h.content, timestamp: new Date() }));
    const spamResult = detectSpam(message, recentMessages);
    if (spamResult.isSpam && spamResult.confidence > 0.7) {
        throw new ApiError(400, 'Message flagged as spam', { spamDetection: spamResult });
    }

    // ── 2. Check if in a multi-step pickup flow ───────────────────────────────
    const activePickupSession = getPickupSession(userId);
    if (activePickupSession) {
        const result = await handlePickupFlow(userId, message, activePickupSession);
        if (result) {
            const quickReplies = result.quickReplies || suggestQuickReplies(history, message);
            return res.json({ response: result.response, message: result.response, source: 'agent', status: 'success', pickupCreated: result.pickupCreated || null, quickReplies });
        }
    }

    // ── 3. Intent detection ──────────────────────────────────────────────────
    const intent = detectIntent(message);
    console.log(`[AgentChat] intent="${intent}" message="${message.substring(0, 60)}"`);

    // ── 4. Tool dispatch (zero Gemini calls for tool intents) ─────────────────

    // 4a. Item search
    if (intent === 'SEARCH_ITEMS') {
        const query = extractSearchQuery(message);
        const result = await toolSearchItems(query);
        const quickReplies = result.found
            ? ['Search another item', 'Browse marketplace', 'View map', 'Book pickup']
            : ['Browse all items', 'Post an item', 'Schedule pickup'];
        return res.json({ response: result.message, message: result.message, source: 'agent', status: 'success', pickupCreated: null, quickReplies });
    }

    // 4b. Campaign info
    if (intent === 'GET_CAMPAIGNS') {
        const result = await toolGetCampaigns();
        const quickReplies = ['Join a campaign', 'Earn credits', 'Browse items', 'Schedule pickup'];
        return res.json({ response: result.message, message: result.message, source: 'agent', status: 'success', pickupCreated: null, quickReplies });
    }

    // 4c. Check credits/stats
    if (intent === 'CHECK_CREDITS') {
        const result = await toolGetUserStats(userId);
        const quickReplies = ['How to earn more?', 'Browse items', 'Join campaign', 'Schedule pickup'];
        return res.json({ response: result.message, message: result.message, source: 'agent', status: 'success', pickupCreated: null, quickReplies });
    }

    // 4d. Initiate pickup booking (multi-step flow)
    if (intent === 'BOOK_PICKUP') {
        // Check for quick single-line pickup like "schedule plastic pickup tomorrow"
        const quickParse = parsePickupRequest(message);
        if (quickParse.isPickupRequest && quickParse.wasteType && quickParse.date) {
            // Enough info inline — skip flow, go straight to service
            const response = await chat_createPickupInline(userId, quickParse);
            const quickReplies = suggestQuickReplies(history, message);
            return res.json({ response, message: response, source: 'agent', status: 'success', pickupCreated: null, quickReplies });
        }
        // Not enough info — start multi-step flow
        setPickupSession(userId, { step: 'wasteType', data: {} });
        const quickReplies = ['Plastic', 'Metal', 'Glass', 'Organic', 'Others'];
        return res.json({ response: PICKUP_PROMPTS.wasteType, message: PICKUP_PROMPTS.wasteType, source: 'agent', status: 'success', pickupCreated: null, quickReplies });
    }

    // 4e. Tracking intent (uses socket state)
    const trackingInfo = await parseTrackingQuery(message, userId);
    if (trackingInfo) {
        const response = trackingInfo.found
            ? `📍 **Live Tracking Update**\n\n${trackingInfo.message}\n\n*Location last updated: ${new Date(trackingInfo.lastUpdated).toLocaleTimeString()}*`
            : trackingInfo.message;
        const quickReplies = ['Contact collector', 'Reschedule pickup', 'My dashboard', 'Eco tips'];
        return res.json({ response, message: response, source: 'agent', status: 'success', pickupCreated: null, quickReplies });
    }

    // ── 5. Gemini call (GENERAL or PLATFORM_HELP intents) ────────────────────
    const user = await User.findById(userId).select('ecoScore credits');
    if (!user) throw new ApiError(404, 'User not found');

    const context = {
        userInfo: { ecoScore: user.ecoScore, walletCredits: user.credits },
        // Send only last 6 exchanges to save tokens (12 messages max)
        history: history.slice(-12),
        language,
        // Inject platform knowledge into system prompt via userInfo string
        platformKnowledge: PLATFORM_KNOWLEDGE,
    };

    let result;
    let cacheHit = false;
    const cacheKey = aiCache.key('chat_v2', message, language);
    const cached = aiCache.get(cacheKey);

    if (cached) {
        result = { response: cached, message: cached, source: 'cache', status: 'success' };
        cacheHit = true;
    } else {
        result = await chatWithAI(message, context);
        // Only cache generic / non-personal queries
        if (intent === 'GENERAL' || intent === 'PLATFORM_HELP') {
            aiCache.set(cacheKey, result.response, DEFAULTS.chat);
        }
    }

    const quickReplies = suggestQuickReplies(history, message);
    res.set('X-Cache-Hit', cacheHit ? 'true' : 'false');
    return res.json({ 
        response: result.response, 
        message: result.message, 
        source: result.source, 
        status: result.status, 
        pickupCreated: null, 
        quickReplies 
    });
}

async function clearSession(req, res) {
    const userId = req.user._id;
    setPickupSession(userId, null);
    return res.json({ success: true, message: 'Session cleared.' });
}

/**
 * Executes the formal creation of a pickup request in the database based on the Chatbot flow's payload,
 * delegating exactly to the same API used by the Waste Pickup Page.
 */
async function createPickupRequest({ userId, wasteType, quantity, latitude, longitude, pickupDate, pickupTime }) {
    return await wasteService.createWasteRequest({
        userId,
        wasteType,
        quantity,
        location: { lat: latitude, lng: longitude },
        address: 'User location (auto-detected)',
        date: pickupDate,
        timeSlot: pickupTime
    });
}

// Inline pickup creation for fully-specified single messages
async function chat_createPickupInline(userId, parsed) {
    try {
        const dateString = resolvePickupDate(parsed);
        const timeSlot = TIME_SLOT_MAP[parsed.timeSlot] || '09:00-12:00';
        const wasteRequest = await createPickupRequest({
            userId,
            wasteType: parsed.wasteType,
            quantity: parsed.quantity || 1,
            latitude: 12.9716,
            longitude: 77.5946,
            pickupDate: dateString,
            pickupTime: timeSlot
        });
        return `✅ **Pickup Scheduled!**\nRequest created for **${parsed.quantity || 1}kg** of **${parsed.wasteType}** on **${dateString}** during **${timeSlot}**.\n\nRequest ID: \`${wasteRequest._id}\`\n\nA collector will contact you soon! Head to [Dashboard](/dashboard) to track it. 🌱`;
    } catch (err) {
        console.error('Inline pickup error:', err);
        return '❌ Sorry, I couldn\'t schedule the pickup automatically. Please use the [Waste Pickup page](/waste).';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Remaining handlers (unchanged from v1)
// ─────────────────────────────────────────────────────────────────────────────

async function barterSuggestions(req, res) {
    const userId = req.user._id;
    const [userItems, marketplaceItems, user] = await Promise.all([
        Item.find({ seller: userId, status: 'Available' }).select('title description category price').populate('seller', 'name'),
        Item.find({ seller: { $ne: userId }, status: 'Available' }).select('title description category price').populate('seller', 'name').limit(20),
        User.findById(userId).select('ecoScore credits'),
    ]);
    if (!user) throw new ApiError(404, 'User not found');
    const suggestions = await generateBarterSuggestions(userItems, marketplaceItems, { ecoScore: user.ecoScore, walletCredits: user.credits });
    return res.json({ userItems, marketplaceItems: marketplaceItems.slice(0, 10), suggestions });
}

async function classifyWaste(req, res) {
    const file = req.file;
    if (!file) throw new ApiError(400, 'No image file provided');
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) throw new ApiError(400, 'Invalid file type.');
    if (file.size > 5 * 1024 * 1024) throw new ApiError(400, 'File too large. Max 5 MB.');
    const ext = (file.originalname.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `waste-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const upload = await mediaService.uploadToCloudinary(file.buffer, fileName, 'waste-classification');
    const classification = await classifyWasteFromImage(upload.secure_url);
    return res.json({ success: true, classification, imageUrl: upload.secure_url });
}

async function quickReplies(req, res) {
    const { message, conversationHistory = [] } = req.body;
    const cacheKey = aiCache.key('quickReply', message);
    let suggestions = aiCache.get(cacheKey);
    if (!suggestions) {
        suggestions = await suggestQuickReplies(conversationHistory, message);
        aiCache.set(cacheKey, suggestions, DEFAULTS.quickReply);
    }
    res.set('X-Cache-Hit', suggestions ? 'true' : 'false');
    return res.json({ suggestions });
}

async function detectSpamMessage(req, res) {
    const { message, recentMessages = [] } = req.body;
    const spamResult = await detectSpam(message, recentMessages);
    return res.json({ spamDetection: spamResult });
}

async function translate(req, res) {
    const { message, targetLanguage, sourceLanguage = 'auto' } = req.body;
    const cacheKey = aiCache.key('translate', message, targetLanguage, sourceLanguage);
    let cached = aiCache.get(cacheKey);
    let cacheHit = false;
    if (cached) {
        cacheHit = true;
    } else {
        cached = await translateMessage(message, targetLanguage, sourceLanguage);
        aiCache.set(cacheKey, cached, DEFAULTS.translate);
    }
    res.set('X-Cache-Hit', cacheHit ? 'true' : 'false');
    return res.json({ translation: cached });
}

async function analyzeEco(req, res) {
    const userId = req.user._id;
    const user = await User.findById(userId).select('ecoScore co2SavedKg wasteRecycledKg itemsReusedCount credits');
    if (!user) throw new ApiError(404, 'User not found');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = { createdAt: { $gte: thirtyDaysAgo } };
    const [recentPickups, recentBarters] = await Promise.all([
        PickupTransaction.find({ $or: [{ userId }, { collectorId: userId }], ...dateFilter }).select('weightKg amount createdAt').sort({ createdAt: -1 }).limit(10),
        BarterRequest.find({ $or: [{ fromUser: userId }, { toUser: userId }], status: 'accepted', ...dateFilter }).select('createdAt').sort({ createdAt: -1 }).limit(10),
    ]);
    const recentActivities = [
        ...recentPickups.map(p => ({ type: 'waste_pickup', description: `Recycled ${p.weightKg}kg of waste`, date: p.createdAt })),
        ...recentBarters.map(b => ({ type: 'barter', description: 'Successfully bartered an item', date: b.createdAt })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    const analysis = await analyzeEcoActivities(user, recentActivities);
    return res.json({
        userStats: { ecoScore: user.ecoScore, co2SavedKg: user.co2SavedKg, wasteRecycledKg: user.wasteRecycledKg, itemsReusedCount: user.itemsReusedCount, credits: user.credits },
        recentActivities: recentActivities.slice(0, 5),
        analysis,
    });
}

module.exports = { chat, clearSession, barterSuggestions, classifyWaste, quickReplies, detectSpamMessage, translate, analyzeEco };