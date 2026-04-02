// Language detection utility for English, Hindi, and Kannada

export interface LanguageDetection {
  language: 'en' | 'hi' | 'kn'
  confidence: number
  detected: boolean
}

/**
 * Count how many characters in the text match a given regex pattern.
 */
function countMatches(text: string, pattern: RegExp): number {
  return (text.match(new RegExp(pattern.source, 'g')) || []).length
}

/**
 * Detect the language of a given text string.
 * Uses Unicode character ranges for script-based detection with confidence scoring.
 * Supports: English (Latin), Hindi (Devanagari), Kannada.
 */
export const detectLanguage = (text: string): LanguageDetection => {
  if (!text || text.trim().length === 0) {
    return { language: 'en', confidence: 0, detected: false }
  }

  const trimmed = text.trim()

  // Unicode character ranges for each script
  const hindiPattern   = /[\u0900-\u097F]/   // Devanagari (Hindi)
  const kannadaPattern = /[\u0C80-\u0CFF]/   // Kannada script
  const latinPattern   = /[a-zA-Z]/          // Basic Latin (English)

  const totalChars = trimmed.replace(/\s+/g, '').length || 1

  const hindiCount   = countMatches(trimmed, hindiPattern)
  const kannadaCount = countMatches(trimmed, kannadaPattern)
  const latinCount   = countMatches(trimmed, latinPattern)

  const hindiRatio   = hindiCount   / totalChars
  const kannadaRatio = kannadaCount / totalChars
  const latinRatio   = latinCount   / totalChars

  // Prefer whichever non-Latin script is most dominant (threshold: > 20%)
  if (hindiRatio >= kannadaRatio && hindiRatio > 0.2) {
    return {
      language: 'hi',
      confidence: Math.min(0.5 + hindiRatio * 0.5, 0.99),
      detected: true
    }
  }

  if (kannadaRatio > 0.2) {
    return {
      language: 'kn',
      confidence: Math.min(0.5 + kannadaRatio * 0.5, 0.99),
      detected: true
    }
  }

  // Even a single Hindi / Kannada character in otherwise Latin text → honour it
  if (hindiCount > 0 && hindiCount >= kannadaCount) {
    return { language: 'hi', confidence: 0.7, detected: true }
  }

  if (kannadaCount > 0) {
    return { language: 'kn', confidence: 0.7, detected: true }
  }

  // Fallback: Latin / English
  return {
    language: 'en',
    confidence: latinRatio > 0.5 ? 0.9 : 0.5,
    detected: latinCount > 0
  }
}

// Human-readable display names
export const languageNames: Record<string, string> = {
  en: 'English',
  hi: 'हिंदी',
  kn: 'ಕನ್ನಡ'
}

// ISO 639-1 codes (same values, but useful as a typed map)
export const languageCodes: Record<string, string> = {
  en: 'en',
  hi: 'hi',
  kn: 'kn'
}