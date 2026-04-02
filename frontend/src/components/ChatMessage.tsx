import { useTranslation } from 'react-i18next';
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Languages, Check, Copy, Leaf, User } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatMessageProps {
  message: Message
  index: number
  onTranslate?: (content: string, targetLang: string) => void
  selectedLanguage?: string
}

/** Formats a Date into e.g. "3:45 PM" */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Renders plain-text with basic bold (**text**) support */
function RichText({ text }: { text: string }) {
  const { t } = useTranslation();
  const segments = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {segments.map((seg, i) =>
        seg.startsWith('**') && seg.endsWith('**') ? (
          <strong key={i}>{seg.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </>
  )
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  index,
  onTranslate,
  selectedLanguage = 'en',
}) => {
  const { t } = useTranslation();
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const handleTranslate = () => {
    if (onTranslate && selectedLanguage !== 'en') {
      onTranslate(message.content, selectedLanguage)
    }
  }

  return (
    <motion.div
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.05, 0.3),
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
      onHoverStart={() => setShowActions(true)}
      onHoverEnd={() => setShowActions(false)}
    >
      {/* Avatar */}
      <motion.div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
          isUser
            ? 'bg-gradient-to-br from-teal-400 to-green-500'
            : 'bg-gradient-to-br from-green-400 to-teal-500'
        }`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: Math.min(index * 0.05, 0.3) + 0.05, type: 'spring', stiffness: 400, damping: 20 }}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Leaf className="w-3.5 h-3.5 text-white" />
        )}
      </motion.div>

      {/* Bubble + meta */}
      <div className={`group max-w-[72%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>

        {/* Bubble */}
        <div className="relative">
          <motion.div
            className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg whitespace-pre-wrap break-words ${
              isUser
                ? 'bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500 text-white rounded-br-sm shadow-green-300/40'
                : 'bg-white/20 backdrop-blur-md text-gray-900 border border-white/30 rounded-bl-sm shadow-gray-300/20'
            }`}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
          >
            {/* Inner shimmer for AI bubble */}
            {!isUser && (
              <div className="absolute inset-0 rounded-2xl rounded-bl-sm bg-gradient-to-br from-green-400/5 to-teal-500/5 pointer-events-none" />
            )}
            {/* Inner shimmer for user bubble */}
            {isUser && (
              <div className="absolute inset-0 rounded-2xl rounded-br-sm bg-white/10 pointer-events-none" />
            )}
            <div className="relative">
              <RichText text={message.content} />
            </div>
          </motion.div>

          {/* Action buttons (copy + translate) */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                className={`absolute top-0 flex gap-1 ${isUser ? 'right-full mr-1.5' : 'left-full ml-1.5'}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  title={t('auto.title_copy_message', `Copy message`)}
                  className="w-6 h-6 bg-white/80 backdrop-blur-sm hover:bg-white text-gray-600 rounded-full flex items-center justify-center shadow-md transition-colors"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>

                {/* Translate button — only shown when language != English */}
                {!isUser && onTranslate && selectedLanguage !== 'en' && (
                  <button
                    onClick={handleTranslate}
                    title={t('auto.title_translate_message', `Translate message`)}
                    className="w-6 h-6 bg-white/80 backdrop-blur-sm hover:bg-blue-500 hover:text-white text-gray-600 rounded-full flex items-center justify-center shadow-md transition-colors"
                  >
                    <Languages className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-gray-400/80 px-1 select-none">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </motion.div>
  )
}

export default ChatMessage