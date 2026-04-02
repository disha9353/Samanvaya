import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'

import { QrCode, MessageCircle, Heart, Copy, X } from 'lucide-react'
import { http } from '../api/http'
import type { RootState } from '../store/types'
import type { Item } from '../types/models'
import QRScanner from '../components/qr/QRScanner'

export default function ItemDetailsPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useSelector((s: RootState) => s.auth.user)

  const [item, setItem] = useState<Item | null>(null)
  const [myItems, setMyItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Barter
  const [offeredItemId, setOfferedItemId] = useState<string>('')
  const [extraCredits, setExtraCredits] = useState<number>(0)
  const [barterBusy, setBarterBusy] = useState(false)

  // QR payment
  const [buyerId, setBuyerId] = useState<string>('')
  const [qrToken, setQrToken] = useState<string>('')
  const [qrImage, setQrImage] = useState<string>('')
  const [transactionId, setTransactionId] = useState<string>('')
  const [qrBusy, setQrBusy] = useState(false)
  const [sendQrBusy, setSendQrBusy] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [payBusy, setPayBusy] = useState(false)

  const isSeller = useMemo(() => {
    if (!user || !item) return false
    const seller = typeof item.seller === 'string' ? null : (item.seller as any)
    return seller?._id === user._id
  }, [user, item])

  useEffect(() => {
    let ignore = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        setItem(null)
        const [itemRes, myRes] = await Promise.all([
          http.get(`/api/items/${id}`),
          http.get(`/api/items/me`),
        ])
        if (ignore) return
        setItem(itemRes.data)
        setMyItems(myRes.data.items || [])
      } catch (e: any) {
        if (ignore) return
        setError(e?.response?.data?.message || e.message || t('errors.failed_load_item'))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [id])

  useEffect(() => {
    if (myItems.length && !offeredItemId) setOfferedItemId(myItems[0]._id)
  }, [myItems, offeredItemId])

  async function interested() {
    if (!item) return
    const res = await http.post(`/api/items/${item._id}/interested`)
    setItem(res.data.item || item)
  }

  async function submitBarter() {
    if (!item || !user) return
    if (!offeredItemId) {
      setError(t('errors.choose_offer_item'))
      return
    }
    try {
      setBarterBusy(true)
      setError(null)
      const res = await http.post('/api/barter/requests', {
        offeredItemId,
        requestedItemId: item._id,
        credits: extraCredits,
      })
      // After creating, navigate to dashboard so the other user can accept.
      navigate('/dashboard')
      return res.data
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_barter'))
    } finally {
      setBarterBusy(false)
    }
  }

  async function generateQR() {
    if (!item || !user) return
    if (!buyerId) {
      setError(t('errors.select_buyer'))
      return
    }
    try {
      setQrBusy(true)
      setError(null)
      const res = await http.post('/api/transactions/generate', { buyerId, itemId: item._id })
      setQrToken(res.data.token)
      setQrImage(res.data.qrCode)
      setTransactionId(res.data.transactionId)
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_qr'))
    } finally {
      setQrBusy(false)
    }
  }

  async function emailQRCards() {
    if (!transactionId) return
    try {
      setSendQrBusy(true)
      await http.post('/api/transactions/send-qr', { transactionId })
      alert('QR Code successfully sent to buyer contextually!')
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to send QR email')
    } finally {
      setSendQrBusy(false)
    }
  }

  async function payWithToken(tokenStr: string) {
    if (!user) return
    try {
      setPayBusy(true)
      setError(null)
      
      let parsedToken = tokenStr
      try {
        const obj = JSON.parse(tokenStr)
        if (obj.token) parsedToken = obj.token
      } catch (e) {
        // Plain text token fallback
      }

      await http.post('/api/transactions/complete', { token: parsedToken, buyerId: user._id })
      
      setScanOpen(false)
      setManualToken('')
      // Refresh item status dynamically
      const itemRes = await http.get(`/api/items/${id}`)
      setItem(itemRes.data)
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.payment_failed'))
    } finally {
      setPayBusy(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-primary-50 dark:bg-dark-bg flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full"
      />
    </div>
  )
  if (error) {
    return (
      <div className="min-h-screen bg-primary-50 dark:bg-dark-bg p-4">
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      </div>
    )
  }
  if (!item) return (
    <div className="min-h-screen bg-primary-50 dark:bg-dark-bg p-4">
      <div className="text-primary-900 dark:text-[var(--text-secondary)]">{t('item.details.not_found')}</div>
    </div>
  )

  const sellerObj = typeof item.seller === 'string' ? null : (item.seller as any)
  const sellerName = sellerObj?.name || t('common.seller')

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-dark-bg p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Item Details */}
        <div className="lg:col-span-2 bg-primary-50/70 dark:bg-black/50 backdrop-blur-md rounded-3xl shadow-glass overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-80 bg-secondary-100 dark:bg-dark-bg"
          >
            {item.images?.[0] ? (
              <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover rounded-t-3xl" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-secondary-400 dark:text-[var(--text-secondary)] opacity-50">{t('item.details.no_image')}</div>
            )}
          </motion.div>
          <div className="p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-primary-900 dark:text-[var(--text-primary)]">{item.title}</h1>
                <div className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80 mt-1">{t('common.by')} {sellerName}</div>
              </div>
              <div className="text-right">
                <div className="text-accent dark:text-accent text-2xl font-bold">{t('item.details.credits_price', { n: item.price })}</div>
                <div className="text-xs text-secondary-500 dark:text-[var(--text-secondary)] opacity-70 mt-1">{t('item.details.status', { status: item.status })}</div>
              </div>
            </div>

            {item.description && <p className="text-secondary-700 dark:text-[var(--text-secondary)] mt-6 leading-relaxed">{item.description}</p>}

            <div className="flex flex-wrap items-center gap-4 mt-6">
              <span className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80">{t('item.details.interested_count', { count: item.interestedUsers?.length || 0 })}</span>
              <span className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80">{t('item.details.saved_count', { count: item.savedUsers?.length || 0 })}</span>
              <span className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80">{t('item.details.liked_count', { count: item.likedUsers?.length || 0 })}</span>
            </div>

            <div className="flex gap-3 mt-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!user || isSeller || item.status !== 'Available'}
                onClick={() => interested()}
                className="flex items-center gap-2 px-6 py-3 bg-secondary-500 hover:bg-secondary-600 text-[var(--text-primary)] rounded-full font-medium disabled:opacity-50 shadow-lg"
              >
                <Heart className="w-4 h-4" />
                {t('item.details.interested_btn')}
              </motion.button>

              {!isSeller && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/chat/${sellerObj?._id || ''}?itemId=${item._id}`)}
                  disabled={!sellerObj?._id}
                  className="flex items-center gap-2 px-6 py-3 glass opacity-300 dark:glass backdrop-blur-md text-primary-900 dark:text-[var(--text-primary)] rounded-full font-medium border border-black/5 dark:border-white/20 dark:border-black/5 dark:border-white/10 disabled:opacity-50"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t('chat.thread_title')}
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-6">
          {item.status === 'Available' && !isSeller && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/70 dark:bg-black/50 backdrop-blur-md rounded-2xl p-6 shadow-glass"
            >
              <h3 className="text-lg font-semibold text-primary-900 dark:text-[var(--text-primary)] mb-4">{t('item.details.barter_title')}</h3>
              <p className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80 mb-4">{t('item.details.barter_hint')}</p>

              <label className="block text-sm font-medium text-primary-900 dark:text-[var(--text-primary)] mb-2">{t('item.details.your_item')}</label>
              <select
                value={offeredItemId}
                onChange={(e) => setOfferedItemId(e.target.value)}
                className="w-full mb-4 rounded-xl border border-black/5 dark:border-white/20 dark:border-black/5 dark:border-white/10 glass opacity-300 dark:glass px-4 py-3 outline-none focus:border-primary-400"
              >
                {myItems.map((mi) => (
                  <option key={mi._id} value={mi._id}>
                    {mi.title} ({mi.price} {t('common.credits_abbr')})
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-primary-900 dark:text-[var(--text-primary)] mb-2">{t('item.details.extra_credits')}</label>
              <input
                type="number"
                min={0}
                step={1}
                value={extraCredits}
                onChange={(e) => setExtraCredits(Number(e.target.value))}
                className="w-full mb-4 rounded-xl border border-black/5 dark:border-white/20 dark:border-black/5 dark:border-white/10 glass opacity-300 dark:glass px-4 py-3 outline-none focus:border-primary-400"
              />

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={barterBusy || !offeredItemId}
                onClick={submitBarter}
                className="w-full py-3 bg-secondary-500 hover:bg-secondary-600 text-[var(--text-primary)] rounded-xl font-medium disabled:opacity-50 shadow-lg"
              >
                {barterBusy ? t('item.details.sending') : t('item.details.send_barter')}
              </motion.button>
            </motion.div>
          )}

          {item.status === 'Available' && isSeller && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-primary-50/70 dark:bg-black/50 backdrop-blur-md rounded-2xl p-6 shadow-glass"
            >
              <h3 className="text-lg font-semibold text-primary-900 dark:text-[var(--text-primary)] mb-4">{t('item.details.qr_title')}</h3>
              <p className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80 mb-4">{t('item.details.qr_hint')}</p>

              <label className="block text-sm font-medium text-primary-900 dark:text-[var(--text-primary)] mb-2">{t('item.details.select_buyer')}</label>
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="w-full mb-4 rounded-xl border border-black/5 dark:border-white/20 dark:border-black/5 dark:border-white/10 glass opacity-300 dark:glass px-4 py-3 outline-none focus:border-primary-400"
              >
                <option value="">{t('item.details.choose_buyer')}</option>
                {(item.interestedUsers || []).map((uid) => (
                  <option key={uid} value={uid}>
                    {uid}
                  </option>
                ))}
              </select>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={qrBusy || !buyerId}
                onClick={generateQR}
                className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-[var(--text-primary)] rounded-xl font-medium disabled:opacity-50 shadow-lg"
              >
                {qrBusy ? t('item.details.generating_qr') : t('item.details.generate_qr')}
              </motion.button>

              {qrImage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 flex flex-col items-center gap-4"
                >
                  <div className="relative">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-2xl border-4 border-primary-500/50"
                    />
                    <img src={qrImage} alt={t('item.details.qr_alt')} className="relative rounded-2xl bg-white p-4 shadow-lg" />
                  </div>
                  
                  <div className="flex gap-2 w-full">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigator.clipboard?.writeText(qrToken)}
                      className="flex-1 flex justify-center items-center gap-2 px-4 py-2 w-full glass opacity-300 dark:glass backdrop-blur-md rounded-xl text-sm font-bold border border-black/5 dark:border-white/20"
                    >
                      <Copy className="w-4 h-4" />
                      {t('item.details.copy_token')}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={sendQrBusy}
                      onClick={emailQRCards}
                      className="flex-1 flex justify-center items-center gap-2 px-4 py-2 w-full bg-primary-100 hover:bg-primary-200 dark:bg-primary-900/50 dark:hover:bg-primary-900/80 text-primary-700 dark:text-primary-300 backdrop-blur-md rounded-xl text-sm font-bold border border-primary-200 dark:border-primary-800 disabled:opacity-50"
                    >
                      {sendQrBusy ? 'Sending...' : 'Email QR'}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {!isSeller && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-primary-50/70 dark:bg-black/50 backdrop-blur-md rounded-2xl p-6 shadow-glass"
            >
              <h3 className="text-lg font-semibold text-primary-900 dark:text-[var(--text-primary)] mb-4">{t('item.details.pay_qr_title')}</h3>
              <p className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80 mb-4">{t('item.details.pay_qr_hint')}</p>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setScanOpen(true)}
                className="w-full mb-4 py-3 bg-primary-500 hover:bg-primary-600 text-[var(--text-primary)] rounded-xl font-medium shadow-lg flex items-center justify-center gap-2"
              >
                <QrCode className="w-5 h-5" />
                {t('item.details.scan_qr_btn')}
              </motion.button>

              <div>
                <label className="block text-sm font-medium text-primary-900 dark:text-[var(--text-primary)] mb-2">{t('item.details.paste_token')}</label>
                <input
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full mb-3 rounded-xl border border-black/5 dark:border-white/20 dark:border-black/5 dark:border-white/10 glass opacity-300 dark:glass px-4 py-3 outline-none focus:border-primary-400"
                  placeholder={t('item.details.token_ph')}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={payBusy || !manualToken}
                  onClick={() => payWithToken(manualToken)}
                  className="w-full py-3 bg-secondary-500 hover:bg-secondary-600 text-[var(--text-primary)] rounded-xl font-medium disabled:opacity-50 shadow-lg"
                >
                  {payBusy ? t('item.details.processing') : t('item.details.pay_now')}
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {scanOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50"
            onClick={() => setScanOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-primary-50/80 dark:bg-black/80 backdrop-blur-md rounded-3xl p-6 shadow-glass relative"
            >
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-3xl border-4 border-primary-500/30 pointer-events-none"
              />
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-primary-900 dark:text-[var(--text-primary)]">{t('item.details.scanner_title')}</h3>
                  <p className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80">{t('item.details.scanner_hint')}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setScanOpen(false)}
                  className="p-2 rounded-full glass opacity-300 dark:glass hover:bg-white/70 dark:hover:bg-black/50"
                >
                  <X className="w-5 h-5 text-primary-900 dark:text-[var(--text-primary)]" />
                </motion.button>
              </div>
              <QRScanner
                onDecoded={(text) => {
                  payWithToken(text)
                  setScanOpen(false)
                }}
                onError={(err) => setError(String(err))}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

