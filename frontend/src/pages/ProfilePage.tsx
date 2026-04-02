import { useEffect, useMemo, useState } from 'react'
import { http } from '../api/http'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import type { RootState } from '../store/types'

type LeaderUser = {
  _id: string
  name: string
  role: string
  ecoScore: number
  co2SavedKg: number
  wasteRecycledKg: number
  itemsReusedCount: number
  credits: number
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const user = useSelector((s: RootState) => s.auth.user)
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        const res = await http.get('/api/eco/leaderboard?limit=10')
        if (ignore) return
        setLeaderboard(res.data.leaderboard || [])
      } catch (e: any) {
        if (ignore) return
        setError(e?.response?.data?.message || e.message || t('errors.failed_load_leaderboard'))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [])

  const myIndex = useMemo(() => leaderboard.findIndex((u) => u._id === user?._id), [leaderboard, user?._id])

  if (loading) return <div className="animate-pulse text-white font-bold">{t('profile.loading')}</div>
  if (error) return <div className="text-red-100 bg-red-500/10 border border-red-400/20 rounded-xl p-4">{error}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">{t('profile.title')}</h1>
      <p className="text-sm font-bold text-white mt-1">{t('profile.subtitle')}</p>

      <div className="mt-5 rounded-2xl border border-black/5 dark:border-white/10 glass p-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl glass border border-black/5 dark:border-white/10 flex items-center justify-center text-white font-bold">
            {(user?.name || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-white font-bold text-lg">{user?.name}</div>
            <div className="text-sm font-bold text-white">{user?.email}</div>
            <div className="text-xs font-bold text-white mt-1">
              {t('profile.role_label')}: <span className="text-white font-bold">{user?.role}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-black/5 dark:border-white/10 glass p-3">
            <div className="text-xs font-bold text-white">{t('profile.credits')}</div>
            <div className="text-lg font-bold text-white">{user?.credits ?? 0}</div>
          </div>
          <div className="rounded-xl border border-black/5 dark:border-white/10 glass p-3">
            <div className="text-xs font-bold text-white">{t('profile.eco_score')}</div>
            <div className="text-lg font-bold text-white">{user?.ecoScore ?? 0}</div>
          </div>
          <div className="rounded-xl border border-black/5 dark:border-white/10 glass p-3">
            <div className="text-xs font-bold text-white">{t('profile.leaderboard_rank')}</div>
            <div className="text-lg font-bold text-white">{myIndex >= 0 ? `#${myIndex + 1}` : '-'}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-black/5 dark:border-white/10 glass p-5">
        <h2 className="text-white font-bold">{t('profile.eco_leaderboard')}</h2>
        <div className="mt-3 space-y-2">
          {leaderboard.slice(0, 8).map((u, idx) => (
            <div key={u._id} className={`flex items-center justify-between rounded-xl border border-black/5 dark:border-white/10 glass p-3 ${u._id === user?._id ? 'border-primary-400/30 shadow-glow' : ''}`}>
              <div className="min-w-0">
                <div className="text-white font-bold truncate">
                  {idx + 1}. {u.name}
                </div>
                <div className="text-xs font-bold text-white">{t('profile.role_label')}: {u.role}</div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">{u.ecoScore} {t('profile.score_label')}</div>
                <div className="text-xs font-bold text-white">{t('profile.co2_saved_kg', { n: u.co2SavedKg })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-black/5 dark:border-white/10 glass p-5 mb-10">
        <h2 className="text-white font-bold text-lg border-b border-black/5 dark:border-white/10 pb-3">{t('profile.security_title')}</h2>
        <p className="text-sm font-bold text-white mt-3 mb-4">{t('profile.security_desc')}</p>

        <div className="flex items-center justify-between glass p-4 rounded-xl border border-black/5 dark:border-white/10">
          <div>
            <div className="text-white font-bold">{t('profile.mfa_require')}</div>
            <div className="text-xs font-bold text-white">{user?.isMFAEnabled ? t('profile.mfa_protected') : t('profile.mfa_vulnerable')}</div>
          </div>
          <button
            onClick={async () => {
              try {
                const res = await http.post('/api/auth/toggle-mfa')
                alert(res.data.message)
                window.location.reload() // quick refresh to update user state natively
              } catch (e: any) {
                alert(t('alerts.action_failed'))
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${user?.isMFAEnabled ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-primary-500/20 text-secondary-300 hover:bg-primary-500/30'}`}
          >
            {user?.isMFAEnabled ? t('profile.disable_mfa') : t('profile.enable_mfa')}
          </button>
        </div>

        {user?.isMFAEnabled && !user.hasTotpSecret && (
          <div className="mt-4 bg-emerald-900/10 border border-primary-500/20 p-4 rounded-xl">
            <h3 className="text-white font-bold">{t('profile.totp_title')}</h3>
            <p className="text-sm font-bold text-white mt-1 mb-3">{t('profile.totp_desc')}</p>
            
            <MfaTotpSetup />
          </div>
        )}

        {user?.hasTotpSecret && (
          <div className="mt-4 glass p-4 rounded-xl border border-primary-500/30 flex justify-between items-center">
             <div>
               <div className="text-white font-bold flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                 {t('profile.totp_active')}
               </div>
               <div className="text-xs font-bold text-white">{t('profile.totp_active_hint')}</div>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MfaTotpSetup() {
  const { t } = useTranslation()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const setupTotp = async () => {
    setLoading(true)
    try {
      const { http } = await import('../api/http')
      const res = await http.post('/api/auth/enable-totp')
      setQrCode(res.data.qrCodeUrl)
    } catch (e) {
      alert(t('alerts.failed_to_launch_setup'))
    } finally {
      setLoading(false)
    }
  }

  if (qrCode) {
    return (
      <div className="text-center bg-white rounded-xl p-4 w-fit mx-auto mt-4">
        <h4 className="text-black font-bold mb-2">{t('profile.scan_qr')}</h4>
        <img src={qrCode} alt={t('auto.alt_totp_qr_code', `TOTP QR Code`)} className="mx-auto w-48 h-48 border border-gray-200 rounded p-2" />
        <p className="text-black font-bold text-xs mt-3">{t('profile.scan_hint')}</p>
        <button onClick={() => window.location.reload()} className="mt-4 w-full bg-primary-500 hover:bg-primary-600 text-white rounded-lg py-2 text-sm font-bold transition-colors">
          {t('profile.scanned_done')}
        </button>
      </div>
    )
  }

  return (
    <button
      disabled={loading}
      onClick={setupTotp}
      className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
    >
      {loading ? t('profile.generating_keys') : t('profile.configure_totp')}
    </button>
  )
}

