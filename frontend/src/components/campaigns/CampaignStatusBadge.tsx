import { useTranslation } from 'react-i18next'
import type { CampaignStatus } from '../../types/campaigns'

export default function CampaignStatusBadge({ status }: { status: CampaignStatus | string | undefined }) {
  const { t } = useTranslation()
  const s = String(status || 'OPEN').toUpperCase()
  const mapped: CampaignStatus = (s === 'FULL' || s === 'COMPLETED' ? (s as CampaignStatus) : 'OPEN') as CampaignStatus

  const label =
    mapped === 'OPEN' ? t('campaign.badge.open') : mapped === 'FULL' ? t('campaign.badge.full') : t('campaign.badge.completed')

  const cls =
    mapped === 'OPEN'
      ? 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20'
      : mapped === 'FULL'
        ? 'bg-amber-400/15 text-amber-200 border-amber-300/20'
        : 'bg-sky-400/15 text-sky-200 border-sky-300/20'

  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
}

