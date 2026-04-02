import { useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { http } from '../api/http'
import { detectLanguage } from '../utils/languageDetection'

export type SupportedLanguage = 'en' | 'hi' | 'kn'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isRateLimit?: boolean     // true when this message is a 429 notice
}

interface ChatResponse {
  response: string
  pickupCreated?: string | null
  quickReplies?: string[]
  spamDetection?: {
    isSpam: boolean
    confidence: number
    reasons: string[]
    severity: string
  }
}

/** Localised welcome messages shown when the chatbot first opens. */
const welcomeMessages: Record<SupportedLanguage, string> = {
  en: "Hello! I'm **EcoBot** 🌿 — your intelligent EcoBarter assistant.\n\nI can help you:\n• 🔍 **Search items** — \"Find plastic bottle\"\n• ♻️ **Book a pickup** — \"Schedule waste pickup\"\n• 🏕️ **View campaigns** — \"Show active campaigns\"\n• 💰 **Check credits** — \"My eco score\"\n• 🗺️ **Navigate the app** — \"How to earn credits?\"\n\nWhat would you like to do?",
  hi: "नमस्ते! मैं **EcoBot** 🌿 हूँ — आपका EcoBarter सहायक।\n\nमैं आपकी मदद कर सकता हूँ:\n• 🔍 वस्तुएं खोजें — \"प्लास्टिक की बोतल खोजें\"\n• ♻️ पिकअप बुक करें — \"कचरा पिकअप शेड्यूल करें\"\n• 🏕️ अभियान देखें — \"सक्रिय अभियान दिखाएं\"\n• 💰 क्रेडिट जांचें — \"मेरा इको स्कोर\"\n\nआप क्या करना चाहते हैं?",
  kn: "ನಮಸ್ಕಾರ! ನಾನು **EcoBot** 🌿 — ನಿಮ್ಮ EcoBarter ಸಹಾಯಕ.\n\nನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ:\n• 🔍 ವಸ್ತುಗಳ ಹುಡುಕಾಟ — \"ಪ್ಲಾಸ್ಟಿಕ್ ಬಾಟಲ್ ಹುಡುಕಿ\"\n• ♻️ ಪಿಕಪ್ ಬುಕ್ ಮಾಡಿ — \"ತ್ಯಾಜ್ಯ ಪಿಕಪ್ ನಿಗದಿ ಮಾಡಿ\"\n• 🏕️ ಅಭಿಯಾನಗಳನ್ನು ನೋಡಿ — \"ಸಕ್ರಿಯ ಅಭಿಯಾನಗಳನ್ನು ತೋರಿಸಿ\"\n• 💰 ಕ್ರೆಡಿಟ್ ಪರಿಶೀಲಿಸಿ — \"ನನ್ನ ಇಕೋ ಸ್ಕೋರ್\"\n\nನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?"
}

/** Localised rate-limit messages with countdown placeholder {N}. */
const rateLimitMessages: Record<SupportedLanguage, (sec: number) => string> = {
  en: (sec) => `⏳ You're sending messages too quickly. Please wait **${sec} seconds** and try again.`,
  hi: (sec) => `⏳ आप बहुत तेज़ी से संदेश भेज रहे हैं। कृपया **${sec} सेकंड** प्रतीक्षा करें और पुनः प्रयास करें।`,
  kn: (sec) => `⏳ ನೀವು ತುಂಬಾ ಬೇಗ ಸಂದೇಶಗಳನ್ನು ಕಳುಹಿಸುತ್ತಿದ್ದೀರಿ. ದಯವಿಟ್ಟು **${sec} ಸೆಕೆಂಡ್** ಕಾಯಿರಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.`,
}

interface UseChatbotReturn {
  messages: Message[]
  isLoading: boolean
  quickReplies: string[]
  /** The detected language of the most-recent typed message (ISO 639-1 code). */
  detectedLanguage: SupportedLanguage
  /** Seconds remaining before the user can send again (0 = not rate-limited). */
  rateLimitCountdown: number
  sendMessage: (content: string) => Promise<void>
  /** Sends a quick reply using the session language so AI answers in the right language. */
  sendQuickReply: (content: string) => Promise<void>
  clearMessages: () => void
}

export const useChatbot = (): UseChatbotReturn => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: welcomeMessages.en,
      timestamp: new Date()
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [quickReplies, setQuickReplies] = useState<string[]>([
    'Schedule Pickup',
    'Search items',
    'View campaigns',
    'My eco score'
  ])
  const [detectedLanguage, setDetectedLanguage] = useState<SupportedLanguage>('en')
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0)

  /**
   * sessionLangRef keeps the LAST CONFIRMED language across renders so that
   * sendQuickReply (which is called outside the normal message flow) always
   * uses the most-recent user-typed language preference rather than 're-detecting'
   * from the quick-reply string (which is always in English).
   */
  const sessionLangRef = useRef<SupportedLanguage>('en')
  const debounceTimerRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<number | null>(null)

  /** Start a visible countdown so the user knows when they can retry. */
  const startRateLimitCountdown = useCallback((seconds: number) => {
    // Clear any existing countdown
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }

    setRateLimitCountdown(seconds)

    countdownTimerRef.current = window.setInterval(() => {
      setRateLimitCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!)
          countdownTimerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  /**
   * Core send function.
   * @param content        Message text to send.
   * @param forceLanguage  Override language detection (used by sendQuickReply).
   */
  const sendMessage = useCallback(async (
    content: string,
    forceLanguage?: SupportedLanguage
  ) => {
    if (!content.trim() || isLoading) return

    // Block sending while rate-limited
    if (rateLimitCountdown > 0) return

    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    const userMessage: Message = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Snapshot messages before state update for use inside the async closure
    const currentMessages = [...messages, userMessage]

    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        // Use forced language (quick-reply) OR detect from the typed message
        let lang: SupportedLanguage
        if (forceLanguage) {
          lang = forceLanguage
        } else {
          const detection = detectLanguage(content.trim())
          lang = detection.language as SupportedLanguage
          sessionLangRef.current = lang
          setDetectedLanguage(lang)
        }

        const response = await http.post('/api/ai/chat', {
          message: userMessage.content,
          history: currentMessages
            .slice(1)
            .map(m => ({ role: m.role, content: m.content })),
          language: lang
        })
        const data: ChatResponse = response.data

        const aiMessage: Message = {
          role: 'assistant',
          content: data.response || "I couldn't process that.",
          timestamp: new Date()
        }

        setMessages(prev => [...prev, aiMessage])
        setQuickReplies(data.quickReplies || [])

      } catch (error) {
        console.error('Chat error:', error)

        // ── 429 Rate-limit handling ────────────────────────────────────────
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const lang = sessionLangRef.current

          // Read retry window from server response (backend sends retryAfterSec)
          const retryAfterSec: number =
            error.response.data?.retryAfterSec ??
            parseInt(error.response.headers?.['retry-after'] ?? '60', 10)

          startRateLimitCountdown(retryAfterSec)

          const rateLimitMsg: Message = {
            role: 'assistant',
            content: rateLimitMessages[lang](retryAfterSec),
            timestamp: new Date(),
            isRateLimit: true,
          }
          setMessages(prev => [...prev, rateLimitMsg])
          setQuickReplies([])
          return
        }

        // ── Generic error ──────────────────────────────────────────────────
        const errorMessages: Record<SupportedLanguage, string> = {
          en: "Sorry, I'm having trouble connecting right now. Please try again later.",
          hi: "क्षमा करें, अभी कनेक्ट करने में समस्या हो रही है। कृपया बाद में पुनः प्रयास करें।",
          kn: "ಕ್ಷಮಿಸಿ, ಈಗ ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆ ಆಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
        }

        const errorMessage: Message = {
          role: 'assistant',
          content: errorMessages[sessionLangRef.current],
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
        debounceTimerRef.current = null
      }
    }, 300)
  }, [messages, isLoading, rateLimitCountdown, startRateLimitCountdown])

  /**
   * Send a quick-reply suggestion.
   * The quick-reply text is always in English, but we want the AI to respond
   * in whatever language the user last typed in — so we pass the session language.
   */
  const sendQuickReply = useCallback(async (content: string) => {
    await sendMessage(content, sessionLangRef.current)
  }, [sendMessage])

  const clearMessages = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    sessionLangRef.current = 'en'
    setDetectedLanguage('en')
    setRateLimitCountdown(0)
    setMessages([
      {
        role: 'assistant',
        content: welcomeMessages.en,
        timestamp: new Date()
      }
    ])
    setQuickReplies([
      'Schedule Pickup',
      'Search items',
      'View campaigns',
      'My eco score'
    ])
    setIsLoading(false)
    // Clear backend agent session
    http.post('/api/ai/clear-session').catch(() => {});
  }, [])

  return {
    messages,
    isLoading,
    quickReplies,
    detectedLanguage,
    rateLimitCountdown,
    sendMessage: async (content) => sendMessage(content),
    sendQuickReply,
    clearMessages
  }
}