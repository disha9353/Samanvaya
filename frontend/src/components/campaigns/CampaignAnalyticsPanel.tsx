import { useTranslation } from 'react-i18next';
import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

export default function CampaignAnalyticsPanel({ campaign }: { campaign: any }) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    // Basic funnel metrics
    const capacity = campaign.maxParticipants || 0
    const interested = Array.isArray(campaign.interestedUsers) ? campaign.interestedUsers.length : (campaign.dashboardStats?.totalParticipants || 0)
    const joined = Array.isArray(campaign.participants) ? campaign.participants.length : 0
    const attended = Array.isArray(campaign.attendees) ? campaign.attendees.length : (campaign.dashboardStats?.totalAttendees || 0)

    const arr = [
      { name: 'Interested', value: interested, color: '#f59e0b' },
      { name: 'Joined', value: joined, color: '#3b82f6' },
      { name: 'Attended', value: attended, color: '#10b981' }
    ]
    
    if (capacity > 0) {
      arr.unshift({ name: 'Capacity', value: capacity, color: '#475569' })
    }

    return arr
  }, [campaign])

  const attendedValue = data.find(d => d.name === 'Attended')?.value || 0
  const joinedValue = data.find(d => d.name === 'Joined')?.value || 0
  const retentionRate = joinedValue > 0 ? Math.round((attendedValue / joinedValue) * 100) : 0

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
        <span>📈</span> {t('auto.campaign_performance_insights', `Campaign Performance Insights`)}
                    </h2>
      
      <div className="h-56 w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 12 }} 
              width={80}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
        <div>
          <div className="text-[11px] text-white/50">{t('auto.conversion_rate_join_attend', `Conversion Rate (Join → Attend)`)}</div>
          <div className="text-xl font-bold text-white mt-1">{retentionRate}%</div>
        </div>
        <div>
          <div className="text-[11px] text-white/50">{t('auto.credits_disbursed', `Credits Disbursed`)}</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{campaign.dashboardStats?.creditsDistributed || 0}</div>
        </div>
      </div>
    </div>
  )
}
