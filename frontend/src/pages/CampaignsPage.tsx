import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'

import type { RootState } from '../store/types'
import { fetchCampaigns, joinCampaign, setJoinedLocal } from '../store/campaignsSlice'
import CampaignCard from '../components/campaigns/CampaignCard'
import VolunteerLeaderboard from '../components/campaigns/VolunteerLeaderboard'
import type { Campaign } from '../types/campaigns'

type Tab = 'all' | 'open' | 'full' | 'completed'

export default function CampaignsPage() {
  const { t } = useTranslation()
  const dispatch = useDispatch<any>()
  const list = useSelector((s: RootState) => s.campaigns.list) as Campaign[]
  const status = useSelector((s: RootState) => s.campaigns.status)
  const error = useSelector((s: RootState) => s.campaigns.error)
  const user = useSelector((s: RootState) => s.auth.user)

  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [joinBusy, setJoinBusy] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchCampaigns())
  }, [dispatch])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return (list || [])
      .filter((c: Campaign) => {
        const statusText = String(c.status || '').toUpperCase()
        const participants = c.participants?.length || 0
        const max = c.maxParticipants || 0
        const derived = statusText === 'COMPLETED' ? 'COMPLETED' : max > 0 && participants >= max ? 'FULL' : statusText === 'FULL' ? 'FULL' : 'OPEN'
        if (tab === 'open' && derived !== 'OPEN') return false
        if (tab === 'full' && derived !== 'FULL') return false
        if (tab === 'completed' && derived !== 'COMPLETED') return false
        if (!query) return true
        const hay = `${c.title || ''} ${c.location || ''}`.toLowerCase()
        return hay.includes(query)
      })
      .sort((a: Campaign, b: Campaign) => {
        const ad = a.dateTime ? new Date(a.dateTime).getTime() : 0
        const bd = b.dateTime ? new Date(b.dateTime).getTime() : 0
        return bd - ad
      })
  }, [list, q, tab])

  async function onJoin(id: string) {
    if (!user) return
    try {
      setJoinBusy(id)
      // optimistic local joined badge to keep UI snappy
      dispatch(setJoinedLocal({ campaignId: id, joined: true }))
      await dispatch(joinCampaign({ campaignId: id }))
    } catch {
      dispatch(setJoinedLocal({ campaignId: id, joined: false }))
    } finally {
      setJoinBusy(null)
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`rounded-full px-5 py-2 text-sm font-semibold border transition-all shadow-sm ${
        tab === id 
          ? 'border-secondary-500/50 bg-secondary-500/20 text-secondary-500 dark:text-secondary-50 shadow-glow' 
          : 'border-black/5 dark:border-white/10 glass text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--text-primary)]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="relative lg:flex lg:gap-8 min-h-screen text-[var(--text-primary)] max-w-7xl mx-auto">
      <div className="flex-1 w-full min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--text-primary)]">{t('campaigns.page_title')}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t('campaigns.page_subtitle')}</p>
          </div>

        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('campaigns.search_ph')}
            className="w-full sm:w-72 rounded-full border border-black/10 dark:border-white/20 glass px-4 py-2 outline-none focus:border-primary-500 placeholder-[var(--text-secondary)] text-[var(--text-primary)] transition-colors"
          />
          <Link
            to="/campaigns/create"
            className="rounded-full bg-primary-500 hover:bg-primary-600 px-6 py-2 text-sm font-bold text-white whitespace-nowrap shadow-glow transition-all hover:scale-105"
          >
            {t('campaigns.create')}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        {tabBtn('all', t('campaigns.tab_all'))}
        {tabBtn('open', t('campaigns.tab_open'))}
        {tabBtn('full', t('campaigns.tab_full'))}
        {tabBtn('completed', t('campaigns.tab_completed'))}
      </div>

      {status === 'loading' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass-card h-64 animate-pulse"></div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-accent/20 bg-accent/10 p-5 text-accent shadow-glow">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-[var(--text-secondary)] text-center py-12 glass rounded-3xl">{t('campaigns.none')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((c: Campaign) => (
            <CampaignCard key={c._id} campaign={c} onJoin={onJoin} joinBusy={joinBusy === c._id} />
          ))}
        </div>
      )}
      </div>

      <div className="hidden lg:block w-80 shrink-0">
        <div className="sticky top-24">
          <VolunteerLeaderboard />
        </div>
      </div>

      <Link
        to="/campaigns/create"
        className="fixed bottom-6 right-6 md:right-10 md:bottom-10 h-14 w-14 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-glow hover:bg-primary-600 hover:scale-110 transition-all z-50 lg:hidden"
        aria-label={t('campaigns.create_aria')}
        title={t('campaigns.create_aria')}
      >
        <span className="text-3xl leading-none font-light">+</span>
      </Link>
    </div>
  )
}

