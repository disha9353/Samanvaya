import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react'
import { http } from '../../api/http'

type Leader = {
  _id: string
  name: string
  profilePic?: string
  credits: number
}

export default function VolunteerLeaderboard() {
  const { t } = useTranslation();
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    http.get('/api/campaigns/leaderboard')
      .then(res => setLeaders(res.data.leaderboard || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse bg-white/5 h-64 rounded-2xl w-full border border-white/10"></div>
  if (!leaders.length) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 w-full">
      <h2 className="text-lg font-semibold text-emerald-300 mb-5 flex items-center gap-2">
        <span>🏆</span> {t('auto.top_volunteers', `Top Volunteers`)}
                    </h2>
      <div className="space-y-4">
        {leaders.map((u, i) => (
          <div key={u._id} className="flex items-center gap-3">
            <div className="w-5 text-center text-xs font-bold text-white/40">{i + 1}</div>
            <img 
              src={u.profilePic || `https://ui-avatars.com/api/?name=${u.name}&background=random`} 
              className="w-8 h-8 rounded-full bg-black/50 border border-white/10 object-cover shrink-0" 
              alt={u.name} 
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{u.name}</div>
              <div className="text-[10px] text-emerald-400/80">{u.credits} {t('auto.credits_earned', `credits earned`)}</div>
            </div>
            {i === 0 && <div className="text-xl">🥇</div>}
            {i === 1 && <div className="text-xl">🥈</div>}
            {i === 2 && <div className="text-xl">🥉</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
