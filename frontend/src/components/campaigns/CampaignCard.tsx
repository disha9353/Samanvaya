import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { MapPin, Clock, Users, ArrowRight } from 'lucide-react'

import type { Campaign } from '../../types/campaigns'
import type { RootState } from '../../store/types'
import CampaignStatusBadge from './CampaignStatusBadge'

function clampText(text: string, max = 140) {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export default function CampaignCard({
  campaign,
  onJoin,
  joinBusy,
}: {
  campaign: Campaign
  onJoin: (id: string) => void
  joinBusy?: boolean
}) {
  const { t } = useTranslation()
  const user = useSelector((s: RootState) => s.auth.user)
  const joinedLocal = useSelector((s: RootState) => Boolean(s.campaigns?.joinedIds?.[campaign._id]))

  const participantsCount = useMemo(() => (campaign.participants?.length ? campaign.participants.length : 0), [campaign.participants])
  const max = campaign.maxParticipants || 0
  const pct = useMemo(() => {
    if (!max) return 0
    return Math.max(0, Math.min(100, Math.round((participantsCount / max) * 100)))
  }, [participantsCount, max])

  const statusText = String(campaign.status || '').toUpperCase()
  const derivedStatus =
    statusText === 'COMPLETED' ? 'COMPLETED' : max > 0 && participantsCount >= max ? 'FULL' : statusText === 'FULL' ? 'FULL' : 'OPEN'

  const organizerName =
    typeof campaign.organizer === 'string'
      ? t('common.organizer')
      : campaign.organizer?.name
        ? campaign.organizer.name
        : t('common.organizer')

  const alreadyJoined = joinedLocal || campaign.participants?.some((p: any) => (typeof p === 'string' ? p === user?._id : p?._id === user?._id))
  const isFull = derivedStatus === 'FULL'
  const isCompleted = derivedStatus === 'COMPLETED'
  const joinDisabled = Boolean(joinBusy || alreadyJoined || isFull || isCompleted)

  const hrs = campaign.durationHours ?? 1
  const rate = campaign.creditsPerHour ?? 50
  const credits = campaign.totalCredits ?? Math.round(hrs * rate)

  return (
    <motion.div 
      whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(46,196,182,0.15)' }}
      className="rounded-3xl glass-card overflow-hidden transition-all duration-300 group border border-black/5 dark:border-white/10 hover:border-primary-500/30 flex flex-col h-full"
    >
      <div className="relative h-56 overflow-hidden">
        {campaign.imageUrl ? (
          <img src={campaign.imageUrl} alt={campaign.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] bg-white/5">{t('campaign.card.no_image')}</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-primary-900/90 to-transparent" />
        
        <div className="absolute top-4 right-4 flex gap-2">
            <CampaignStatusBadge status={derivedStatus} />
        </div>
        
        {/* Credits Badge Float */}
        <div className="absolute bottom-4 left-4 glass px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-black/5 dark:border-white/20 shadow-lg">
           <span className="text-sm">🏅</span>
           <span className="text-sm font-bold text-accent">{credits} {t('auto.credits', `Credits`)}</span>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow relative">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-[var(--text-primary)] truncate group-hover:text-primary-500 transition-colors mb-2">{campaign.title}</h3>
          
          <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs text-[var(--text-secondary)] mb-3 font-medium">
             <div className="flex items-center gap-1.5">
               <MapPin className="w-3.5 h-3.5 text-primary-500" />
               <span className="truncate max-w-[120px]">{campaign.location || t('campaign.card.location_tbd')}</span>
             </div>
             <div className="flex items-center gap-1.5">
               <Clock className="w-3.5 h-3.5 text-primary-500" />
               <span>{hrs}{t('auto.h_duration', `h Duration`)}</span>
             </div>
             <div className="flex items-center gap-1.5">
               <Users className="w-3.5 h-3.5 text-primary-500" />
               <span>{organizerName}</span>
             </div>
          </div>
          
          {campaign.description && (
             <p className="text-sm text-[var(--text-secondary)] leading-relaxed min-h-[40px]">{clampText(campaign.description, 100)}</p>
          )}
        </div>

        <div className="mt-auto">
          {max > 0 && (
            <div className="mb-5">
              <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1.5 font-medium">
                 <span>{t('auto.participation', `Participation`)}</span>
                 <span>{participantsCount} / {max} {t('auto.joined', `joined`)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: `${pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-secondary-500 to-primary-500 rounded-full" 
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: joinDisabled ? 1 : 1.05 }}
              whileTap={{ scale: joinDisabled ? 1 : 0.95 }}
              disabled={joinDisabled}
              onClick={() => onJoin(campaign._id)}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-all
                ${alreadyJoined 
                  ? 'bg-secondary-500/20 text-secondary-600 dark:text-secondary-50 border border-secondary-500/30' 
                  : isCompleted 
                    ? 'glass text-[var(--text-secondary)] opacity-60' 
                    : isFull 
                      ? 'glass text-[var(--text-secondary)] opacity-60' 
                      : 'bg-primary-500 hover:bg-primary-600 text-white shadow-glow'}`}
            >
              {alreadyJoined
                ? 'You Joined ✓'
                : isCompleted
                  ? t('campaign.card.completed_btn')
                  : isFull
                    ? t('campaign.card.full_btn')
                    : joinBusy
                      ? t('campaign.card.joining')
                      : 'Join Campaign'}
            </motion.button>
            <Link
              to={`/campaigns/${campaign._id}`}
              className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl glass hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

