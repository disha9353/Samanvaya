import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { io, Socket } from 'socket.io-client'

import type { RootState } from '../store/types'
import { http } from '../api/http'

type ChatMessage = {
  _id: string
  sender: string
  receiver: string
  content: string
  itemId?: string
  createdAt: string
}

type Conversation = {
  otherUser: { _id: string; name?: string; profilePic?: string; role?: string }
  itemId: string | null
  lastMessageAt: string
  lastMessage: ChatMessage
}

export default function ChatPage() {
  const { t } = useTranslation()
  const { otherUserId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const itemId = useMemo(() => new URLSearchParams(location.search).get('itemId') || undefined, [location.search])
  const user = useSelector((s: RootState) => s.auth.user)
  const accessToken = useSelector((s: RootState) => s.auth.accessToken)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const listRef = useRef<HTMLDivElement | null>(null)

  async function loadConversations() {
    if (!user || !accessToken) return
    const res = await http.get('/api/chat/conversations', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    setConversations(res.data.conversations || [])
  }

  useEffect(() => {
    let ignore = false
    async function run() {
      if (!user || !accessToken) return
      try {
        setError(null)
        await loadConversations()

        if (!otherUserId) return
        const res = await http.get(`/api/chat/messages/${otherUserId}`, {
          params: itemId ? { itemId } : {},
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (ignore) return
        setMessages(res.data.messages || [])
      } catch (e: any) {
        if (ignore) return
        setError(e?.response?.data?.message || e.message || t('errors.failed_load_chat'))
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [user, accessToken, otherUserId, itemId])

  useEffect(() => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
    if (!user || !accessToken) return

    const socket: Socket = io(baseURL, { auth: { token: accessToken } })
    socket.on('chat:message', (msg: ChatMessage) => {
      // Always refresh conversation list so new chats show up.
      loadConversations().catch(() => {})

      // If we're not in a thread, don't try to append into message list.
      if (!otherUserId) return
      if (itemId && msg.itemId && msg.itemId !== itemId) return

      // Append only messages involving this thread.
      const other = msg.sender === otherUserId || msg.receiver === otherUserId
      if (!other) return
      setMessages((prev) => [...prev, msg])
    })
    return () => {
      socket.disconnect()
    }
  }, [user, otherUserId, itemId, accessToken])

  useEffect(() => {
    // scroll to bottom on new messages
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    if (!user || !otherUserId) return
    if (!content.trim()) return

    const payload = {
      receiverId: otherUserId,
      itemId: itemId || undefined,
      content: content.trim(),
    }
    setSending(true)
    setError(null)
    setContent('')
    try {
      // REST write is also the background-sync trigger when offline.
      await http.post('/api/chat/messages', payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      // Keep sidebar updated even if socket isn't available.
      await loadConversations()
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_send_message'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-[70vh] grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-1 rounded-2xl border border-black/5 dark:border-white/10 glass opacity-30 p-3 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[var(--text-primary)] font-semibold">{t('chat.sidebar_title')}</div>
          <button
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
            onClick={() => loadConversations().catch(() => {})}
          >
            {t('common.refresh')}
          </button>
        </div>
        {conversations.length === 0 ? (
          <div className="text-sm text-[var(--text-secondary)] opacity-80">{t('chat.none_sidebar')}</div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c, idx) => {
              const active = c.otherUser?._id === otherUserId && String(c.itemId || '') === String(itemId || '')
              const name = c.otherUser?.name || c.otherUser?._id
              return (
                <button
                  key={`${c.otherUser?._id}-${c.itemId || 'none'}-${idx}`}
                  onClick={() => {
                    const qs = c.itemId ? `?itemId=${c.itemId}` : ''
                    navigate(`/chat/${c.otherUser._id}${qs}`)
                  }}
                  className={`w-full text-left rounded-xl border px-3 py-2 ${
                    active ? 'border-primary-400/30 bg-primary-500/10' : 'border-black/5 dark:border-white/10 glass opacity-80 hover:glass'
                  }`}
                >
                  <div className="text-sm text-[var(--text-primary)] opacity-90 font-medium">{name}</div>
                  <div className="text-xs text-[var(--text-secondary)] opacity-80 mt-1 line-clamp-1">{c.lastMessage?.content}</div>
                  <div className="text-[10px] text-[var(--text-primary)]/45 mt-1">
                    {new Date(c.lastMessageAt).toLocaleString()}
                    {c.itemId ? ` • ${t('chat.item_prefix')} ${c.itemId}` : ''}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-100 mb-3">{error}</div>}

      <div className="lg:col-span-2 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[var(--text-primary)] font-semibold">{t('chat.thread_title')}</div>
            <div className="text-xs text-[var(--text-secondary)] opacity-80">{otherUserId ? t('chat.with_user', { id: otherUserId }) : t('chat.select_left')}</div>
          </div>
          {itemId && <div className="text-xs text-secondary-200/90">{t('chat.item_prefix')}: {itemId}</div>}
        </div>

        <div ref={listRef} className="flex-1 overflow-auto rounded-2xl border border-black/5 dark:border-white/10 glass opacity-30 p-3">
          {!otherUserId ? (
            <div className="text-[var(--text-secondary)] opacity-80 text-sm">{t('chat.choose_conv')}</div>
          ) : messages.length === 0 ? (
            <div className="text-[var(--text-secondary)] opacity-80 text-sm">{t('chat.no_messages')}</div>
          ) : (
            <div className="space-y-2">
              {messages.map((m, idx) => {
                const mine = m.sender === user?._id
                return (
                  <div key={m._id || idx} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={`${mine ? 'bg-primary-500/20 border-primary-400/20' : 'glass opacity-80 border-black/5 dark:border-white/10'} max-w-[75%] rounded-2xl px-3 py-2 text-sm text-[var(--text-primary)] opacity-90`}
                      style={{ borderWidth: 1 }}
                    >
                      <div className="text-[var(--text-primary)] opacity-90">{m.content}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] opacity-70 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 rounded-xl border border-black/5 dark:border-white/10 glass opacity-80 px-3 py-2 outline-none focus:border-primary-400/60"
            placeholder={otherUserId ? t('chat.placeholder_active') : t('chat.placeholder_inactive')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
            disabled={sending || !otherUserId}
          />
          <button
            onClick={send}
            disabled={sending || !otherUserId}
            className="rounded-xl bg-primary-500/90 hover:bg-primary-500 px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-60"
          >
            {t('common.send')}
          </button>
        </div>
      </div>
    </div>
  )
}

