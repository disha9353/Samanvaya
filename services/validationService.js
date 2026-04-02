const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ensure GEMINI_API_KEY is available in your environment variables
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Downloads an image from a URL and converts it to a base64 Generative part
 * @param {string} url - The Cloudinary or remote secure URL
 * @param {string} mimeType - The fallback MIME type
 */
async function urlToGenerativePart(url, mimeType = "image/jpeg") {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return {
    inlineData: {
      data: Buffer.from(arrayBuffer).toString("base64"),
      mimeType: response.headers.get("content-type") || mimeType
    },
  };
}

/**
 * AI Pre-validation Service using Gemini 1.5 Flash Vision
 * Analysts uploaded images to detect pollution, reject irrelevant images, and flag suspicious ones.
 * 
 * @param {string} imageUrl - Secure URL of the main media
 * @returns {Promise<{ isValid: boolean, isSuspicious: boolean, details: string }>}
 */
exports.validateReportImage = async (imageUrl) => {
  if (!genAI) {
    console.warn('AI Pre-validation bypassed: GEMINI_API_KEY is clearly missing from .env');
    return { isValid: true, isSuspicious: false, details: 'AI bypassed' };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an AI validation assistant for an ocean and environmental reporting platform.
      Analyze this image thoroughly and determine if it legitimately shows environmental issues or pollution.
      Specific categories to look for: plastic dumping, oil spills, dead marine life, and illegal fishing.
      
      You must respond ONLY with a valid JSON object using the exact schema below. No markdown formatting.
      {
        "isValid": <boolean: true if it shows valid environmental/pollution-related content, false if it is completely irrelevant like a selfie, room, or random objects>,
        "isSuspicious": <boolean: true if the image looks artificially manipulated, ambiguous, or stock-photo-like>,
        "details": "<string: brief 1-2 sentence explanation of your classification>"
      }
    `;

    const imagePart = await urlToGenerativePart(imageUrl);

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    // Clean up potential markdown formatting from the response
    const jsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(jsonString);

    return {
      isValid: analysis.isValid,
      isSuspicious: analysis.isSuspicious,
      details: analysis.details
    };
  } catch (error) {
    console.error('AI Validation Service Error:', error.message);
    
    // Fallback: If AI fails due to network or rate limits, pass it through but flag for manual review
    return {
      isValid: true,
      isSuspicious: true,
      details: 'AI validation encountered an error; flagged for manual review.'
    };
  }
};
