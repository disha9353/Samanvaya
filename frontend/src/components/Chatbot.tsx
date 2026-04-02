import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, X, Leaf, Languages, BarChart3,
  Volume2, VolumeX, Maximize2, Minimize2, Trash2
} from 'lucide-react'
import ChatMessage from './ChatMessage'
import TypingIndicator from './TypingIndicator'
import EcoAnalysis from './EcoAnalysis'
import { useChatbot } from '../hooks/useChatbot'
import { languageNames } from '../utils/languageDetection'
import { useTranslation } from 'react-i18next'

/* ─── Localised placeholders ────────────────────────────────────── */
const inputPlaceholders: Record<string, string> = {
  en: 'Ask me about eco-friendly tips…',
  hi: 'पर्यावरण टिप्स पूछें…',
  kn: 'ಪರಿಸರ ಟಿಪ್ಸ್ ಕೇಳಿ…',
}

/* ─── Web Audio notification sound (no external file needed) ────── */
function playReceiveSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Gentle two-tone chime
    const playTone = (freq: number, startAt: number, dur: number, gain: number) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt)
      gainNode.gain.setValueAtTime(0, ctx.currentTime + startAt)
      gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + dur)
      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + dur)
    }

    playTone(880, 0,    0.18, 0.12)  // A5
    playTone(1100, 0.14, 0.22, 0.08)  // C#6

    setTimeout(() => ctx.close(), 600)
  } catch {
    /* AudioContext unavailable — silently skip */
  }
}

function playSendSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.12)
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)
    setTimeout(() => ctx.close(), 400)
  } catch { /* noop */ }
}

/* ─── Main Component ─────────────────────────────────────────────── */
const Chatbot: React.FC = () => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen]               = useState(false)
  const [isExpanded, setIsExpanded]       = useState(false)
  const [input, setInput]                 = useState('')
  const [showEcoAnalysis, setShowEcoAnalysis] = useState(false)
  const [soundEnabled, setSoundEnabled]   = useState(true)
  const [unreadCount, setUnreadCount]     = useState(0)
  const [pickupDate, setPickupDate]       = useState('')
  const [pickupTime, setPickupTime]       = useState('')
  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLInputElement>(null)
  const prevMsgCount    = useRef(0)

  const {
    messages, isLoading, quickReplies,
    detectedLanguage, rateLimitCountdown,
    sendMessage, sendQuickReply, clearMessages
  } = useChatbot()

  /* ── Scroll to bottom on new message ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  /* ── Unread badge + sound when chat is closed ── */
  useEffect(() => {
    const newCount = messages.length
    if (newCount > prevMsgCount.current) {
      const lastMsg = messages[newCount - 1]
      if (!isOpen && lastMsg?.role === 'assistant' && newCount > 1) {
        setUnreadCount(c => c + 1)
      }
      if (soundEnabled && lastMsg?.role === 'assistant' && newCount > 1) {
        playReceiveSound()
      }
    }
    prevMsgCount.current = newCount
  }, [messages, isOpen, soundEnabled])

  /* ── Clear unread + focus input when opening ── */
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [isOpen])

  const toggleChat = () => setIsOpen(o => !o)

  /* ── Send helpers ── */
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || rateLimitCountdown > 0) return
    const text = input.trim()
    setInput('')
    if (soundEnabled) playSendSound()
    await sendMessage(text)
  }, [input, isLoading, rateLimitCountdown, sendMessage, soundEnabled])

  const handleQuickReplyClick = useCallback(async (reply: string) => {
    if (soundEnabled) playSendSound()

    // Intercept location permission
    const lastMessage = messages[messages.length - 1];
    if (reply === 'Yes, use my location' && lastMessage?.content?.includes('access your location')) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            await sendQuickReply(`[Location] ${lat}, ${lng}`);
          },
          async () => {
            await sendQuickReply('[Location Denied]');
          }
        );
        return;
      } else {
        await sendQuickReply('[Location Denied]');
        return;
      }
    }

    await sendQuickReply(reply)
  }, [sendQuickReply, soundEnabled, messages])

  const handleTranslateMessage = async (content: string, targetLang: string) => {
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ message: content, targetLanguage: targetLang }),
      })
      const data = await res.json()
      if (data.translation) {
        alert(`${t('alerts.translation_title')}:\n${data.translation.translatedText}`)
      }
    } catch (err) {
      console.error('Translation error:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  /* ── Derived values ── */
  const langLabel   = languageNames[detectedLanguage] ?? 'English'
  const placeholder = inputPlaceholders[detectedLanguage] ?? inputPlaceholders.en

  /* ── Panel size ── */
  // On mobile: full-screen when expanded OR default
  // On desktop: 380×560 normal, 500×700 expanded
  const panelW  = isExpanded ? 'w-[calc(100vw-2rem)] sm:w-[500px]' : 'w-[calc(100vw-2rem)] sm:w-[380px]'
  const panelH  = isExpanded ? 'h-[calc(100vh-5rem)] sm:h-[700px]' : 'h-[calc(100vh-5rem)] sm:h-[560px]'
  const msgAreaH = isExpanded
    ? 'flex-1 min-h-0'
    : 'flex-1 min-h-0'

  return (
    <>
      {/* ── Floating Action Button ─────────────────────────────── */}
      <motion.div className="fixed bottom-6 right-4 sm:right-6 z-50">
        {/* Pulse ring (visible only when closed and unread) */}
        <AnimatePresence>
          {!isOpen && unreadCount > 0 && (
            <motion.span
              key="pulse"
              className="absolute inset-0 rounded-full bg-green-400/50"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 1.9, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          id="chatbot-fab"
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
          onClick={toggleChat}
          className="relative w-14 h-14 bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500 rounded-full shadow-xl flex items-center justify-center overflow-hidden"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
          whileHover={{ scale: 1.08, boxShadow: '0 0 0 6px rgba(52,211,153,0.25)' }}
          whileTap={{ scale: 0.93 }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-white/10 rounded-full" />

          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div key="x"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0,   opacity: 1 }}
                exit={{   rotate:  90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="w-6 h-6 text-white" />
              </motion.div>
            ) : (
              <motion.div key="leaf"
                initial={{ rotate: 90,  opacity: 0 }}
                animate={{ rotate: 0,   opacity: 1 }}
                exit={{   rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Leaf className="w-6 h-6 text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unread badge */}
          <AnimatePresence>
            {!isOpen && unreadCount > 0 && (
              <motion.span
                key="badge"
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* ── Chat Panel ────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chatbot-panel"
            role="dialog"
            aria-label={t('auto.aria-label_eco_assistant_chat', `Eco Assistant chat`)}
            className={`
              fixed bottom-24 right-4 sm:right-6 z-40
              ${panelW} ${panelH}
              flex flex-col
              rounded-2xl overflow-hidden
              shadow-2xl shadow-black/20
              border border-white/20
            `}
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            initial={{ opacity: 0, scale: 0.85, y: 24, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.85, y: 24  }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >

            {/* ── Header ──────────────────────────────────────── */}
            <div className="relative bg-gradient-to-r from-green-400 via-emerald-400 to-teal-500 px-4 py-3 text-white flex-shrink-0">
              {/* Subtle noise texture */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.06%22/%3E%3C/svg%3E')] opacity-40 pointer-events-none" />

              <div className="relative flex items-center justify-between">
                {/* Left: avatar + title */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shadow-inner border border-white/30">
                    <Leaf className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight">{t('auto.eco_assistant', `Eco Assistant`)}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`block w-1.5 h-1.5 rounded-full animate-pulse ${
                        rateLimitCountdown > 0 ? 'bg-amber-300' : 'bg-green-200'
                      }`} />
                      <p className="text-[11px] text-white/80">
                        {rateLimitCountdown > 0
                          ? `Rate limited · ${rateLimitCountdown}s`
                          : isLoading ? 'Thinking…' : 'Online'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: controls */}
                <div className="flex items-center gap-1.5">
                  {/* Language badge */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={detectedLanguage}
                      className="flex items-center gap-1 bg-white/20 border border-white/30 rounded-full px-2 py-0.5 text-[11px] font-medium cursor-default"
                      title={`Responding in ${langLabel}`}
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{   opacity: 0, scale: 0.75 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Languages className="w-3 h-3" />
                      {langLabel}
                    </motion.div>
                  </AnimatePresence>

                  {/* Sound toggle */}
                  <button
                    onClick={() => setSoundEnabled(s => !s)}
                    title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    {soundEnabled
                      ? <Volume2 className="w-4 h-4" />
                      : <VolumeX className="w-4 h-4 opacity-60" />}
                  </button>

                  {/* Expand / shrink */}
                  <button
                    onClick={() => setIsExpanded(e => !e)}
                    title={isExpanded ? 'Shrink' : 'Expand'}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    {isExpanded
                      ? <Minimize2 className="w-4 h-4" />
                      : <Maximize2 className="w-4 h-4" />}
                  </button>

                  {/* Clear chat */}
                  <button
                    onClick={clearMessages}
                    title={t('auto.title_clear_chat', `Clear chat`)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Eco Analysis */}
                  <button
                    onClick={() => setShowEcoAnalysis(true)}
                    title={t('auto.title_view_eco_analysis', `View Eco Analysis`)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Messages ─────────────────────────────────────── */}
            <div
              className={`${msgAreaH} overflow-y-auto px-4 py-3 space-y-3 scroll-smooth`}
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(52,211,153,0.3) transparent' }}
            >
              {messages.map((message, i) => (
                <ChatMessage
                  key={i}
                  message={message}
                  index={i}
                  onTranslate={handleTranslateMessage}
                  selectedLanguage={detectedLanguage}
                />
              ))}

              <AnimatePresence>
                {isLoading && <TypingIndicator key="typing" />}
              </AnimatePresence>

              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* ── Quick Replies ─────────────────────────────────── */}
            <AnimatePresence>
              {quickReplies.length > 0 && !isLoading && (
                <motion.div
                  className="px-4 py-2 border-t border-white/15 flex-shrink-0"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{   opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {quickReplies.map((reply, i) => (
                      <motion.button
                        key={reply}
                        onClick={() => handleQuickReplyClick(reply)}
                        className="px-3 py-1 text-[11px] font-medium bg-white/15 hover:bg-gradient-to-r hover:from-green-400/30 hover:to-teal-500/30 text-gray-800 rounded-full border border-white/25 transition-all"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.2 }}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {reply}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── DateTime Picker (Step 5) ───────────────────────── */}
            <AnimatePresence>
              {messages.length > 0 && messages[messages.length - 1].content.includes('select a date and time') && !isLoading && (
                <motion.div
                  className="px-4 py-3 border-t border-white/15 flex-shrink-0 flex flex-col gap-2 bg-white/5"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-[11px] font-semibold text-gray-800">Choose Pickup Schedule:</p>
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      min={new Date().toISOString().split('T')[0]}
                      value={pickupDate} 
                      onChange={e => setPickupDate(e.target.value)} 
                      className="flex-1 bg-white/50 border border-white/50 rounded-lg px-2 py-1.5 text-xs focus:ring focus:ring-green-400/50 outline-none shadow-inner" 
                    />
                    <input 
                      type="time" 
                      value={pickupTime} 
                      onChange={e => setPickupTime(e.target.value)} 
                      className="flex-1 bg-white/50 border border-white/50 rounded-lg px-2 py-1.5 text-xs focus:ring focus:ring-green-400/50 outline-none shadow-inner" 
                    />
                  </div>
                  <button 
                    disabled={!pickupDate || !pickupTime}
                    onClick={() => {
                      if (soundEnabled) playSendSound();
                      sendQuickReply(`[DateTime] ${pickupDate}||${pickupTime}`);
                      setPickupDate('');
                      setPickupTime('');
                    }}
                    className="mt-1 w-full bg-gradient-to-r from-green-400 to-teal-500 text-white font-semibold text-xs py-2 rounded-lg shadow disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Confirm Schedule
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Input Bar ─────────────────────────────────────── */}
            <div className="px-4 py-3 border-t border-white/15 flex-shrink-0">
              {/* Rate-limit countdown banner */}
              <AnimatePresence>
                {rateLimitCountdown > 0 && (
                  <motion.div
                    className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-800 text-xs font-medium"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="text-base">⏳</span>
                    <span>{t('auto.too_many_messages_please_wait', `Too many messages — please wait&nbsp;`)}</span>
                    <span className="tabular-nums font-bold text-amber-900">{rateLimitCountdown}s</span>
                    {/* Progress bar */}
                    <div className="ml-auto w-16 h-1.5 bg-amber-200/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-amber-500/70 rounded-full"
                        initial={{ width: '100%' }}
                        animate={{ width: '0%' }}
                        transition={{ duration: rateLimitCountdown, ease: 'linear' }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    id="chatbot-input"
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s before sending…` : placeholder}
                    disabled={isLoading || rateLimitCountdown > 0}
                    className="
                      w-full pl-4 pr-10 py-2.5
                      bg-white/20 backdrop-blur-sm
                      border border-white/30
                      rounded-full text-sm text-gray-900 placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-green-400/60 focus:border-transparent
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200
                    "
                  />
                  {/* Character count for longer messages */}
                  {input.length > 80 && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ${input.length > 200 ? 'text-red-400' : 'text-gray-400'}`}>
                      {input.length}
                    </span>
                  )}
                </div>

                {/* Send button */}
                <motion.button
                  id="chatbot-send"
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading || rateLimitCountdown > 0}
                  aria-label={t('auto.aria-label_send_message', `Send message`)}
                  className="
                    w-10 h-10 flex-shrink-0
                    bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500
                    rounded-full flex items-center justify-center shadow-lg
                    disabled:opacity-40 disabled:cursor-not-allowed
                    relative overflow-hidden
                  "
                  whileHover={{ scale: 1.08, boxShadow: '0 0 0 5px rgba(52,211,153,0.2)' }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="absolute inset-0 bg-white/10 rounded-full" />
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.div
                        key="loading"
                        className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        initial={{ opacity: 0 }}
                      />
                    ) : (
                      <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <Send className="w-4 h-4 text-white relative" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* Footer label */}
              <p className="text-center text-[10px] text-gray-400/70 mt-2 select-none">
                {t('auto.powered_by_ai_eco_friendly_res', `Powered by AI · Eco-friendly responses`)}
                                            </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Eco Analysis Modal ──────────────────────────────────── */}
      <EcoAnalysis
        isVisible={showEcoAnalysis}
        onClose={() => setShowEcoAnalysis(false)}
      />
    </>
  )
}

export default Chatbot