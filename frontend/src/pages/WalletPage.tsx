import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import Tilt from 'react-parallax-tilt'
import { CreditCard, TrendingUp, Leaf, Recycle } from 'lucide-react'
import { http } from '../api/http'

type Transaction = {
  _id: string
  buyer: string | null
  seller: string | null
  item: string | null
  credits: number
  type: string
  createdAt: string
  meta?: any
}

function TransactionPill({ type, credits }: { type: string; credits: number }) {
  const { t } = useTranslation();
  const isPositive = credits > 0
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
        isPositive
          ? 'bg-secondary-500/20 text-secondary-700 dark:text-secondary-300 border border-secondary-300/30'
          : 'bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-300/30'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${isPositive ? 'bg-secondary-500' : 'bg-primary-500'}`} />
      {type}: {credits > 0 ? '+' : ''}{credits}
    </motion.div>
  )
}

export default function WalletPage() {
  const { t } = useTranslation()
  const [summary, setSummary] = useState<any>(null)
  const [tx, setTx] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        const [sRes, tRes] = await Promise.all([
          http.get('/api/wallet/summary'),
          http.get('/api/wallet/transactions?limit=50'),
        ])
        if (ignore) return
        setSummary(sRes.data.summary)
        setTx(tRes.data.transactions || [])
      } catch (e: any) {
        if (ignore) return
        setError(e?.response?.data?.message || e.message || t('errors.failed_load_wallet'))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-primary-50 dark:bg-dark-bg flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full"
      />
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-primary-50 dark:bg-dark-bg p-4">
      <div className="text-red-100 bg-red-500/10 border border-red-400/20 rounded-xl p-4">{error}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-dark-bg p-4">
      <div className="max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-primary-900 dark:text-[var(--text-primary)] mb-2"
        >
          {t('wallet.title')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-secondary-600 dark:text-[var(--text-secondary)] opacity-80 mb-8"
        >
          {t('wallet.subtitle')}
        </motion.p>

        {/* Neumorphic Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Tilt
            tiltMaxAngleX={10}
            tiltMaxAngleY={10}
            scale={1.05}
            transitionSpeed={400}
            className="w-full"
          >
            <div className="bg-gradient-to-br from-primary-50/80 to-primary-50/60 dark:from-black/80 dark:to-black/60 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-primary-200/30 dark:border-black/5 dark:border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-8 h-8 text-[var(--text-primary)]0" />
                  <span className="text-lg font-semibold text-primary-900 dark:text-[var(--text-primary)]">{t('wallet.card_title')}</span>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-primary-900 dark:text-[var(--text-primary)]">{summary?.credits ?? 0}</div>
                  <div className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80">{t('wallet.available_credits')}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="glass opacity-300 dark:glass rounded-2xl p-4 border border-white/30 dark:border-black/5 dark:border-white/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Leaf className="w-5 h-5 text-secondary-500" />
                    <span className="text-sm font-medium text-primary-900 dark:text-[var(--text-primary)]">{t('wallet.eco_score')}</span>
                  </div>
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{summary?.ecoScore ?? 0}</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="glass opacity-300 dark:glass rounded-2xl p-4 border border-white/30 dark:border-black/5 dark:border-white/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    <span className="text-sm font-medium text-primary-900 dark:text-[var(--text-primary)]">{t('wallet.co2_saved')}</span>
                  </div>
                  <div className="text-2xl font-bold text-accent">{summary?.co2SavedKg ?? 0} {t('auto.kg', `kg`)}</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="glass opacity-300 dark:glass rounded-2xl p-4 border border-white/30 dark:border-black/5 dark:border-white/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Recycle className="w-5 h-5 text-[var(--text-primary)]0" />
                    <span className="text-sm font-medium text-primary-900 dark:text-[var(--text-primary)]">{t('wallet.waste_recycled')}</span>
                  </div>
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{summary?.wasteRecycledKg ?? 0} {t('auto.kg', `kg`)}</div>
                </motion.div>
              </div>
            </div>
          </Tilt>
        </motion.div>

        {/* Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-primary-50/70 dark:bg-black/50 backdrop-blur-md rounded-2xl p-6 shadow-glass"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-primary-900 dark:text-[var(--text-primary)]">{t('wallet.recent_tx')}</h2>
            <div className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80">{tx.length} {t('common.records')}</div>
          </div>

          {tx.length === 0 ? (
            <div className="text-secondary-600 dark:text-[var(--text-secondary)] opacity-80 text-center py-8">{t('wallet.no_tx')}</div>
          ) : (
            <div className="space-y-3">
              {tx.slice(0, 20).map((txnRow, index) => (
                <motion.div
                  key={txnRow._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-primary-50/50 dark:glass rounded-xl border border-primary-200/20 dark:border-black/5 dark:border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <TransactionPill type={txnRow.type} credits={txnRow.credits} />
                    <div className="text-sm text-secondary-600 dark:text-[var(--text-secondary)] opacity-80">
                      {new Date(txnRow.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm text-primary-900 dark:text-[var(--text-primary)] font-medium">
                    {txnRow.credits > 0 ? '+' : ''}{txnRow.credits} {t('common.credits_word')}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

