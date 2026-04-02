/**
 * validationService.js — AI (Gemini) image validation for ocean report media
 */

const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
const ai     = apiKey ? new GoogleGenAI({ apiKey }) : null;

async function urlToGenerativePart(url) {
  const response     = await fetch(url);
  const arrayBuffer  = await response.arrayBuffer();
  return {
    inlineData: {
      data:     Buffer.from(arrayBuffer).toString('base64'),
      mimeType: response.headers.get('content-type') || 'image/jpeg'
    }
  };
}

exports.validateReportImage = async (imageUrl) => {
  if (!ai) {
    console.warn('AI Pre-validation bypassed: GEMINI_API_KEY missing from .env');
    return { isValid: true, isSuspicious: false, details: 'AI bypassed' };
  }

  try {
    const prompt = `
      You are an AI validation assistant for an ocean and environmental reporting platform.
      Analyze this image and determine if it legitimately shows environmental issues or pollution.
      Categories: plastic dumping, oil spills, dead marine life, illegal fishing.
      Respond ONLY with a valid JSON object — no markdown:
      {
        "isValid": <boolean>,
        "isSuspicious": <boolean>,
        "details": "<1-2 sentence explanation>"
      }
    `;

    const imagePart  = await urlToGenerativePart(imageUrl);
    
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        { role: 'user', parts: [
          { text: prompt },
          imagePart
        ] }
      ],
      config: {
        maxOutputTokens: 300,
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    });

    const jsonString = result.text;
    const analysis   = JSON.parse(jsonString);

    return {
      isValid:      analysis.isValid,
      isSuspicious: analysis.isSuspicious,
      details:      analysis.details
    };
  } catch (error) {
    console.error('AI Validation error:', error.message);
    return { isValid: true, isSuspicious: true, details: 'AI validation error; flagged for manual review.' };
  }
};
