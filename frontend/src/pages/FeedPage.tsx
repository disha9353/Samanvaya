import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Heart, Bookmark, Plus, Map, Grid } from 'lucide-react'

import { ItemsMap } from '../components/maps/ItemsMap'

import type { RootState } from '../store/types'
import type { Item } from '../types/models'
import { http } from '../api/http'

export default function FeedPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useSelector((s: RootState) => s.auth.user)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')

  const qs = useMemo(() => {
    const params = new URLSearchParams()
    params.set('status', 'Available')
    if (q.trim()) params.set('q', q.trim())
    params.set('limit', '20')
    return params.toString()
  }, [q])

  useEffect(() => {
    let ignore = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        const res = await http.get(`/api/items?${qs}`)
        if (ignore) return
        setItems(res.data.items || [])
      } catch (e: any) {
        if (ignore) return
        setError(e?.response?.data?.message || e.message || t('errors.failed_load_feed'))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [qs])

  async function toggle(endpoint: string, itemId: string) {
    try {
      setActionBusy(itemId)
      const res = await http.post(`/api/items/${itemId}/${endpoint}`)
      const updated = res.data.item || res.data
      setItems((prev) => prev.map((it) => (it._id === itemId ? { ...it, ...updated } : it)))
    } finally {
      setActionBusy(null)
    }
  }

  async function interested(itemId: string) {
    try {
      setActionBusy(itemId)
      await http.post(`/api/items/${itemId}/interested`)
      // optimistic: just keep UI smooth
      setItems((prev) =>
        prev.map((it) =>
          it._id === itemId ? { ...it, interestedUsers: [...(it.interestedUsers || []), user?._id].filter(Boolean) as string[] } : it
        )
      )
    } catch (e: any) {
      const msg = e?.response?.data?.message || e.message || t('errors.failed_interest')
      setError(msg)
    } finally {
      setActionBusy(null)
    }
  }

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-[var(--text-primary)]">{t('auto.marketplace', `Marketplace`)}</h2>
            <p className="text-[var(--text-secondary)] mt-1">{t('auto.discover_trade_and_exchange_su', `Discover, trade, and exchange sustainable items in your community.`)}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex glass rounded-xl p-1 shadow-sm mr-2">
              <button
                onClick={() => setViewMode('grid')}
                title={t('auto.title_grid_view', `Grid View`)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-500 text-white shadow-md' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10'}`}
              >
                <Grid className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                title={t('auto.title_map_view', `Map View`)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'map' ? 'bg-primary-500 text-white shadow-md' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10'}`}
              >
                <Map className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('auto.placeholder_search_items', `Search items...`)}
              className="w-full sm:w-72 glass rounded-full px-4 py-2 outline-none focus:border-primary-500 text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setQ((s) => s)}
              className="rounded-full bg-primary-500 hover:bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-glow"
            >
              {t('auto.search', `Search`)}
            </motion.button>

            {/* ─ Create Item pill ─ */}
            <motion.button
              whileHover={{ scale: 1.06, boxShadow: '0 0 20px rgba(var(--color-primary-500), 0.4)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/items/new')}
              className="hidden sm:flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-sm font-bold shadow-glow hover:opacity-90 transition-all shrink-0 border border-white/10"
            >
              <Plus className="w-4 h-4" />
              {t('create_item')}
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="glass-card h-64 animate-pulse"></div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-accent/20 bg-accent/10 p-4 text-accent">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-[var(--text-secondary)] text-center py-12">{t('auto.no_items_found_matching_your_s', `No items found matching your search.`)}</div>
        ) : viewMode === 'map' ? (
          <div className="h-[600px] w-full rounded-2xl overflow-hidden glass shadow-glass relative z-0">
            <ItemsMap items={items as any} />
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
            {items.map((it, index) => (
              <motion.div
                key={it._id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className="break-inside-avoid rounded-2xl glass-card overflow-hidden group transition-all hover:-translate-y-1 hover:shadow-glow"
              >
                <div
                  className="relative cursor-pointer aspect-[4/3] overflow-hidden bg-black/5 dark:bg-white/5"
                  onClick={() => navigate(`/items/${it._id}`)}
                  role="button"
                >
                  {it.images?.[0] ? (
                    <img src={it.images[0]} alt={it.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)]">{t('feed.no_image')}</div>
                  )}
                  {/* Glass Top Gradient */}
                  <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

                  {/* Location & Credits Badge */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="glass px-2.5 py-1 text-xs font-semibold text-white dark:text-[var(--text-primary)] rounded-full flex items-center gap-1 shadow-sm border-white/20">
                      <Map className="w-3 h-3 text-secondary-500 dark:text-secondary-50" />
                      {t('auto.available', `Available`)}
                    </span>
                    <span className="glass px-2.5 py-1 text-xs font-bold text-accent rounded-full shadow-sm border-white/20">
                      {it.price} 💰
                    </span>
                  </div>

                  {/* Floating Quick Interest Button */}
                  <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      interested(it._id)
                    }}
                    disabled={!user || actionBusy === it._id}
                    className="absolute top-3 right-3 w-10 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-glow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </motion.button>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xl font-bold text-[var(--text-primary)] truncate transition-colors">{it.title}</div>
                      <div className="text-sm text-[var(--text-secondary)] mt-1 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-secondary-500 text-[10px] flex items-center justify-center text-white mr-1 shadow-md">
                          {(typeof it.seller === 'string' ? 'U' : it.seller?.name?.charAt(0)) || 'U'}
                        </span>
                        {typeof it.seller === 'string' ? t('common.seller') : it.seller?.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-5">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={actionBusy === it._id}
                      onClick={() => toggle('like', it._id)}
                      className="flex-1 glass group/btn rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Heart className="w-4 h-4 text-accent group-hover/btn:scale-110 transition-transform" />
                      {t('feed.like')}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={actionBusy === it._id}
                      onClick={() => toggle('save', it._id)}
                      className="flex-1 glass group/btn rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Bookmark className="w-4 h-4 text-secondary-500 dark:text-secondary-50 group-hover/btn:scale-110 transition-transform" />
                      {t('feed.save')}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB – visible only on small screens where pill is hidden */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => navigate('/items/new')}
        className="sm:hidden fixed bottom-24 right-5 z-50 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-sm font-bold shadow-[0_4px_24px_rgba(0,0,0,0.35)] border border-white/10"
        aria-label={t('create_item')}
      >
        <Plus className="w-5 h-5" />
        <span>{t('create_item')}</span>
      </motion.button>
    </div>
  )
}
