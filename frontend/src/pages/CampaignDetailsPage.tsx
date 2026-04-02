import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { io, type Socket } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import type { RootState } from '../store/types'
import { fetchCampaignById, joinCampaign, setJoinedLocal } from '../store/campaignsSlice'
import CampaignStatusBadge from '../components/campaigns/CampaignStatusBadge'
import CampaignAnalyticsPanel from '../components/campaigns/CampaignAnalyticsPanel'
import { http } from '../api/http'

// ── QR Display Panel (organizer) ──────────────────────────────────────────────
function QrDisplayPanel({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrToken, setQrToken]   = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)
  const [msg, setMsg]           = useState<string | null>(null)

  async function handleGenerate() {
    try {
      setBusy(true)
      setMsg(null)
      const res = await http.post(`/api/campaigns/${campaignId}/generate-qr`)
      const token: string = res.data?.qrToken
      const backendImage: string = res.data?.qrImage
      setQrToken(token)
      
      if (backendImage) {
        setQrDataUrl(backendImage)
      } else {
        const dataUrl = await QRCode.toDataURL(token, { width: 256, margin: 1 })
        setQrDataUrl(dataUrl)
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e.message || 'Failed to generate QR')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 border-t border-black/5 dark:border-white/10 pt-6">
      <h3 className="text-[var(--text-primary)] font-bold text-lg flex items-center gap-2">
        <span className="text-2xl drop-shadow-sm">📲</span> {t('auto.attendance_qr_code', `Attendance QR Code`)}
                    </h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1">
        {t('auto.generate_a_qr_code_participant', `Generate a QR code participants must scan onsite to verify attendance and earn credits.`)}
                    </p>
      
      {!qrDataUrl && (
        <button
          id="btn-generate-qr"
          onClick={handleGenerate}
          disabled={busy}
          className="mt-4 w-full rounded-2xl bg-primary-500 hover:bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-glow disabled:opacity-60 transition-all hover:scale-[1.02]"
        >
          {busy ? 'Generating…' : '⚡ Generate Attendance QR'}
        </button>
      )}

      {msg && <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{msg}</div>}
      
      <AnimatePresence>
        {qrDataUrl && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="mt-6 flex flex-col items-center gap-4 rounded-3xl border border-primary-500/30 glass p-6 shadow-glow relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary-500/5 animate-pulse rounded-3xl pointer-events-none"></div>
            
            <div className="bg-white p-3 rounded-2xl shadow-xl hover:scale-105 transition-transform duration-300">
              <img src={qrDataUrl} alt={t('auto.alt_attendance_qr_code', `Attendance QR Code`)} className="rounded-xl w-56 h-56 object-contain" />
            </div>
            
            <div className="text-sm text-[var(--text-secondary)] text-center font-medium max-w-xs">
              {t('auto.display_this_qr_at_the_campaig', `Display this QR at the campaign venue. Session expires in 24h.`)}
                                      </div>
            
            {qrToken && (
              <div className="w-full mt-2 space-y-2">
                <div className="text-xs font-semibold text-[var(--text-secondary)] opacity-70 uppercase tracking-widest text-center">{t('auto.manual_token', `Manual Token`)}</div>
                <textarea
                  readOnly
                  value={qrToken}
                  rows={2}
                  className="w-full rounded-xl border border-black/10 dark:border-white/20 bg-black/5 dark:bg-black/30 px-3 py-2 text-xs text-[var(--text-primary)] opacity-70 resize-none focus:outline-none"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
            )}
            
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-semibold underline decoration-primary-500/30 transition-colors"
            >
              {t('auto.regenerate_qr', `🔄 Regenerate QR`)}
                                      </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── QR Scan Panel (participant) ───────────────────────────────────────────────
function QrScanPanel({ campaignId, alreadyAttended }: { campaignId: string; alreadyAttended: boolean }) {
  const { t } = useTranslation();
  const [token, setToken]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [result, setResult] = useState<{ creditsEarned: number; message: string } | null>(null)
  const [err, setErr]       = useState<string | null>(null)

  if (alreadyAttended) {
    return (
      <div className="mt-6 rounded-2xl border border-secondary-500/20 bg-secondary-500/10 p-4 text-sm text-secondary-500 dark:text-secondary-50 flex items-center gap-3 shadow-sm">
        <span className="text-xl">✅</span> 
        <span className="font-semibold">{t('auto.attendance_already_recorded', `Attendance already recorded`)}</span>
      </div>
    )
  }

  const [scannerActive, setScannerActive] = useState(false)

  useEffect(() => {
    if (!scannerActive || alreadyAttended) return
    let scanner: Html5QrcodeScanner | null = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    )
    scanner.render(
      (decodedText) => {
        setScannerActive(false)
        if (scanner) {
          scanner.clear().catch(console.error)
          scanner = null
        }
        submitToken(decodedText)
      },
      () => {}
    )
    return () => {
      if (scanner) {
        scanner.clear().catch(console.error)
        scanner = null
      }
    }
  }, [scannerActive, alreadyAttended])

  const submitToken = async (tkn: string) => {
    if (!tkn.trim()) return
    try {
      setBusy(true)
      setErr(null)
      setResult(null)
      let parsedToken = tkn.trim()
      try {
        const jsonObj = JSON.parse(parsedToken)
        if (jsonObj.qrToken) parsedToken = jsonObj.qrToken
        if (jsonObj.campaignId && jsonObj.campaignId !== campaignId) {
          throw new Error('This QR code belongs to a different campaign!')
        }
      } catch (e: any) {
        if (e.message && e.message.includes('belongs to')) throw e
      }

      const res = await http.post(`/api/campaigns/scan`, { 
        campaignId, 
        qrToken: parsedToken 
      })
      setResult({ creditsEarned: res.data?.creditsEarned ?? 0, message: res.data?.message })
      setToken('')
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message || 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify() {
    submitToken(token)
  }

  return (
    <div className="mt-8 border-t border-black/5 dark:border-white/10 pt-6">
      <h3 className="text-[var(--text-primary)] font-bold text-lg flex items-center gap-2">
        <span className="text-2xl drop-shadow-sm">🔍</span> {t('auto.verify_attendance', `Verify Attendance`)}
                    </h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1">
        {t('auto.scan_the_qr_code_at_the_venue', `Scan the QR code at the venue or paste the token to verify your attendance and earn credits.`)}
                    </p>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 rounded-3xl glass border-secondary-500/30 p-6 text-center shadow-glow relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-secondary-500/10 animate-pulse pointer-events-none"></div>
            <div className="text-5xl mb-3 drop-shadow-md">🎉</div>
            <div className="text-secondary-600 dark:text-secondary-50 font-bold text-lg">{result.message}</div>
            {result.creditsEarned > 0 && (
              <div className="mt-2 text-sm text-[var(--text-primary)] font-medium bg-black/5 dark:bg-white/10 inline-block px-3 py-1 rounded-full">
                <span className="text-accent font-bold">+{result.creditsEarned}</span> {t('auto.credits_added_to_your_wallet', `credits added to your wallet`)}
                                            </div>
            )}
          </motion.div>
        ) : scannerActive ? (
          <motion.div 
            key="scanner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 glass-card overflow-hidden"
          >
            <div id="reader" className="w-full bg-white rounded-t-2xl overflow-hidden text-black shadow-inner"></div>
            <div className="p-3 bg-black/5 dark:bg-white/5 border-t border-black/5 dark:border-white/10">
              <button 
                onClick={() => setScannerActive(false)} 
                className="w-full rounded-xl bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 px-4 py-3 text-sm font-bold text-[var(--text-primary)] transition-colors"
              >
                {t('auto.cancel_scanning', `Cancel Scanning`)}
                                                </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6"
          >
            <button 
              onClick={() => setScannerActive(true)} 
              className="w-full rounded-2xl glass border-primary-500/50 bg-primary-500/10 px-4 py-4 text-sm font-bold text-primary-600 dark:text-primary-500 hover:bg-primary-500/20 shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
            >
              <span className="text-xl">📷</span> {t('auto.scan_qr_via_camera', `Scan QR via Camera`)}
                                              </button>
            
            <div className="flex items-center gap-3 mt-6 mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">
              <div className="h-px bg-black/10 dark:bg-white/10 flex-1"></div>
              <span>{t('auto.or_paste_manually', `or paste manually`)}</span>
              <div className="h-px bg-black/10 dark:bg-white/10 flex-1"></div>
            </div>

            <div className="glass-card p-2 rounded-2xl">
              <textarea
                id="attendance-qr-token-input"
                rows={3}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('auto.placeholder_paste_the_qr_token_here', `Paste the QR token here…`)}
                className="w-full rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:bg-black/5 dark:focus:bg-white/5 transition-colors resize-none"
              />
            </div>
            
            {err && <div className="mt-3 text-sm text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{err}</div>}
            
            <button
              id="btn-verify-attendance"
              onClick={handleVerify}
              disabled={busy || !token.trim()}
              className="mt-4 w-full rounded-2xl bg-secondary-500 hover:bg-secondary-600 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50 transition-transform hover:scale-[1.02]"
            >
              {busy ? 'Verifying…' : '✅ Submit Attendance'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CampaignDetailsPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const dispatch = useDispatch<any>()
  const user = useSelector((s: RootState) => s.auth.user)
  const accessToken = useSelector((s: RootState) => s.auth.token)
  const joinedLocal = useSelector((s: RootState) => Boolean(id && s.campaigns?.joinedIds?.[id]))

  const campaign = useSelector((s: RootState) => (id ? s.campaigns.byId[id] : undefined))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinBusy, setJoinBusy] = useState(false)

  // Real-time socket updates for attendance verification
  useEffect(() => {
    if (!id || !accessToken) return
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const socket: Socket = io(baseURL, { auth: { token: accessToken } })
    
    socket.on('campaign_attendance_update', (data: { campaignId: string }) => {
      if (data.campaignId === id) {
        dispatch(fetchCampaignById(id))
      }
    })
    
    return () => {
      socket.disconnect()
    }
  }, [id, accessToken, dispatch])

  useEffect(() => {
    let alive = true
    async function run() {
      if (!id) return
      try {
        setLoading(true)
        setError(null)
        await dispatch(fetchCampaignById(id))
      } catch (e: any) {
        if (!alive) return
        setError(e?.response?.data?.message || e.message || t('errors.failed_load_campaign'))
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [dispatch, id])

  const participants = useMemo(() => {
    const raw = campaign?.participants || []
    return raw.map((p: any) => (typeof p === 'string' ? { _id: p, name: p } : p))
  }, [campaign?.participants])

  const participantsCount = participants.length
  const max = campaign?.maxParticipants || 0
  const isFull = max > 0 && participantsCount >= max
  const statusText = String(campaign?.status || '').toUpperCase()
  const derivedStatus = statusText === 'COMPLETED' ? 'COMPLETED' : isFull || statusText === 'FULL' ? 'FULL' : 'OPEN'

  const organizer = campaign?.organizer
  const organizerId = typeof organizer === 'string' ? organizer : organizer?._id
  const organizerName = typeof organizer === 'string' ? t('common.organizer') : organizer?.name || t('common.organizer')
  const isOrganizer = Boolean(user && organizerId && organizerId === user._id)

  const alreadyJoined =
    joinedLocal || participants.some((p: any) => (typeof p === 'string' ? p === user?._id : p?._id === user?._id))

  const attendedParticipants = (campaign?.attendedParticipants || []) as Array<{ _id: string } | string>
  const alreadyAttended = attendedParticipants.some(
    (p) => (typeof p === 'string' ? p : p._id) === user?._id
  )

  const durationHours  = campaign?.durationHours  ?? 1
  const creditsPerHour = campaign?.creditsPerHour ?? 50
  const totalCredits   = campaign?.totalCredits   ?? Math.round(durationHours * creditsPerHour)

  async function onJoin() {
    if (!id || !user) return
    try {
      setJoinBusy(true)
      dispatch(setJoinedLocal({ campaignId: id, joined: true }))
      // Step 4: System explicitly hits the interested API to queue the user in interestedUsers.
      await http.post(`/api/campaigns/${id}/interested`)
      await dispatch(joinCampaign({ campaignId: id }))
      await dispatch(fetchCampaignById(id))
    } catch (e: any) {
      dispatch(setJoinedLocal({ campaignId: id, joined: false }))
      setError(e?.response?.data?.message || e.message || t('errors.failed_join'))
    } finally {
      setJoinBusy(false)
    }
  }

  if (loading) return <div className="animate-pulse rounded-2xl border border-black/5 dark:border-white/10 glass p-5 text-[var(--text-secondary)] opacity-80">{t('common.loading')}</div>
  if (error) return <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">{error}</div>
  if (!campaign) return <div className="text-[var(--text-secondary)]">{t('campaign.details.not_found')}</div>

  const pct = max ? Math.max(0, Math.min(100, Math.round((participantsCount / max) * 100))) : 0
  const joinDisabled = alreadyJoined || isFull || derivedStatus === 'COMPLETED' || joinBusy

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-2xl border border-black/5 dark:border-white/10 glass overflow-hidden">
        <div className="h-80 glass">
          {campaign.imageUrl ? (
            <img src={campaign.imageUrl} alt={campaign.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] opacity-50">{t('campaign.details.no_image')}</div>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] truncate">{campaign.title}</h1>
              <div className="text-sm text-[var(--text-secondary)] opacity-80 mt-1">
                {t('common.by')} <span className="text-[var(--text-secondary)]">{organizerName}</span>
              </div>
              <div className="text-sm text-[var(--text-secondary)] opacity-80 mt-1">
                {campaign.location || t('campaign.card.location_tbd')}
                {campaign.dateTime ? ` • ${new Date(campaign.dateTime).toLocaleString()}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {alreadyJoined && (
                <span className="text-[11px] rounded-full border border-emerald-300/20 bg-emerald-400/15 px-2 py-0.5 text-emerald-200">
                  {t('campaign.details.you_joined')}
                </span>
              )}
              <CampaignStatusBadge status={derivedStatus} />
            </div>
          </div>

          {campaign.description ? <p className="text-sm text-[var(--text-secondary)] mt-4 whitespace-pre-wrap">{campaign.description}</p> : null}

          {/* ── Credit summary banner ── */}
          <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏱</span>
              <div>
                <div className="text-[11px] text-amber-300/60">{t('auto.duration', `Duration`)}</div>
                <div className="text-sm font-semibold text-amber-200">{durationHours}h</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <div>
                <div className="text-[11px] text-amber-300/60">{t('auto.rate', `Rate`)}</div>
                <div className="text-sm font-semibold text-amber-200">{creditsPerHour} {t('auto.cr_hr', `cr/hr`)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <div>
                <div className="text-[11px] text-amber-300/60">{t('auto.total_reward', `Total Reward`)}</div>
                <div className="text-base font-bold text-emerald-300">{totalCredits} {t('auto.credits', `credits`)}</div>
              </div>
            </div>
          </div>

          {max ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] opacity-80">
                <div>{t('campaign.details.participants_slash', { cur: participantsCount, max })}</div>
                <div>{t('campaign.details.pct_filled', { pct })}</div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden border border-black/5 dark:border-white/10">
                <div className="h-full bg-emerald-400/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ) : (
            <div className="mt-5 text-xs text-[var(--text-secondary)] opacity-80">{t('campaign.details.participants_count', { n: participantsCount })}</div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              id="btn-join-campaign"
              disabled={joinDisabled}
              onClick={onJoin}
              className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-60 transition"
            >
              {alreadyJoined
                ? t('campaign.card.joined_btn')
                : derivedStatus === 'COMPLETED'
                  ? t('campaign.card.completed_btn')
                  : isFull
                    ? t('campaign.card.full_btn')
                    : joinBusy
                      ? t('campaign.card.joining')
                      : t('campaign.card.join')}
            </button>
            <Link
              to="/campaigns"
              className="rounded-xl border border-black/5 dark:border-white/10 glass opacity-90 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-black/30"
            >
              {t('campaign.details.back_feed')}
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 dark:border-white/10 glass p-5">
        <h2 className="text-[var(--text-primary)] font-semibold">{t('campaign.details.participants_header')}</h2>
        <p className="text-sm text-[var(--text-secondary)] opacity-80 mt-1">{t('campaign.details.participants_hint')}</p>

        <div className="mt-4 space-y-2 max-h-[260px] overflow-auto pr-1">
          {participants.length === 0 ? (
            <div className="text-[var(--text-secondary)] opacity-80 text-sm">{t('campaign.details.no_participants')}</div>
          ) : (
            participants.map((p: any) => {
              const pid = typeof p === 'string' ? p : p._id
              const attended = attendedParticipants.some((ap) => (typeof ap === 'string' ? ap : ap._id) === pid)
              return (
                <div key={pid} className="flex items-center justify-between rounded-xl border border-black/5 dark:border-white/10 glass opacity-90 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--text-primary)] opacity-90 truncate">{p.name || pid}</div>
                    <div className="text-[11px] text-[var(--text-secondary)] opacity-70 truncate">{pid}</div>
                  </div>
                  {attended && (
                    <span className="ml-2 shrink-0 text-[10px] rounded-full border border-emerald-400/20 bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                      {t('auto.attended', `✓ attended`)}
                                                  </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── QR Attendance & Analytics Panels ── */}
        {id && isOrganizer && (
          <>
            <CampaignAnalyticsPanel campaign={campaign} />
            <QrDisplayPanel campaignId={id} />
          </>
        )}
        {id && !isOrganizer && alreadyJoined && (
          <QrScanPanel campaignId={id} alreadyAttended={alreadyAttended} />
        )}

        {!isOrganizer && !alreadyJoined && (
          <div className="mt-6 rounded-xl border border-black/5 dark:border-white/10 glass opacity-90 p-3 text-xs text-[var(--text-secondary)] opacity-70">
            {t('auto.join_the_campaign_to_access_th', `Join the campaign to access the attendance verification.`)}
                                </div>
        )}
      </div>
    </div>
  )
}
