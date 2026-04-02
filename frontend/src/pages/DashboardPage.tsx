import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '../api/http'
import { useSelector } from 'react-redux'
import type { RootState } from '../store/types'
import type { Item } from '../types/models'
import { useNavigate } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import CollectorNavigationMap from '../components/maps/CollectorNavigationMap'

type WasteRequest = {
  _id: string
  wasteType: string
  quantity: number
  status: string
  location: { lat: number; lng: number }
  date: string
  timeSlot: string
  userId: { _id: string; name: string; profilePic?: string }
  collectorId?: { _id: string; name: string }
}

type BarterRequest = {
  _id: string
  status: string
  credits: number
  fromUser: { _id: string; name: string }
  toUser: { _id: string; name: string }
  offeredItem: Item
  requestedItem: Item
  createdAt: string
}

type Tx = {
  _id: string
  type: string
  credits: number
  createdAt: string
}

type VolunteerActivity = {
  campaignId: string
  title: string
  location: string
  dateTime?: string | null
  status: 'OPEN' | 'FULL' | 'COMPLETED' | string
  role: 'organizer' | 'participant' | string
  pointsGained: number
  durationHours?: number
  creditsPerHour?: number
  attended?: boolean
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const user = useSelector((s: RootState) => s.auth.user)
  const accessToken = useSelector((s: RootState) => s.auth.accessToken)
  const navigate = useNavigate()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [myItems, setMyItems] = useState<Item[]>([])
  const [interestedItems, setInterestedItems] = useState<Item[]>([])
  const [wasteRequests, setWasteRequests] = useState<WasteRequest[]>([])
  const [collectorRequests, setCollectorRequests] = useState<WasteRequest[]>([])
  const [barterIncoming, setBarterIncoming] = useState<BarterRequest[]>([])
  const [tx, setTx] = useState<Tx[]>([])
  const [volunteerActivities, setVolunteerActivities] = useState<VolunteerActivity[]>([])
  const [volunteerPoints, setVolunteerPoints] = useState(0)

  // Completion form
  const [completion, setCompletion] = useState<Record<string, { weightKg: number; pricePerKg: number }>>({})

  // Location tracking for collectors
  const [isTrackingLocation, setIsTrackingLocation] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationSocket, setLocationSocket] = useState<Socket | null>(null)

  const isCollector = user?.role === 'collector'

  useEffect(() => {
    let ignore = false
    async function run() {
      try {
        setError(null)
        setBusy(true)

        if (isCollector) {
          const res = await http.get('/api/collectors/requests')
          if (ignore) return
          setCollectorRequests(res.data.requests || res.data?.requests || [])
        } else {
          const [itemsRes, intRes, wasteRes, inRes, txRes, volunteerRes] = await Promise.all([
            http.get('/api/items/me'),
            http.get('/api/interests/my'),
            http.get('/api/waste/requests/me'),
            http.get('/api/barter/requests/me?incoming=true'),
            http.get('/api/wallet/transactions?limit=10'),
            http.get('/api/campaigns/my-volunteer-history'),
          ])
          if (ignore) return
          setMyItems(itemsRes.data.items || [])
          setInterestedItems(intRes.data.items || [])
          setWasteRequests(wasteRes.data.requests || [])
          const incomingAll = inRes.data.barterRequests || []
          // Only pending requests are actionable; others are historical noise here.
          setBarterIncoming(incomingAll.filter((br: any) => br?.status === 'pending'))
          // Outgoing barter is not shown in this demo dashboard panel.
          setTx(txRes.data.transactions || [])
          setVolunteerActivities(volunteerRes.data.activities || [])
          setVolunteerPoints(Number(volunteerRes.data.totalPointsGained || 0))
        }
      } catch (e: any) {
        if (ignore) return
        setError(e?.response?.response?.data?.message || e?.response?.data?.message || e.message || t('errors.failed_load_dashboard'))
      } finally {
        if (!ignore) setBusy(false)
      }
    }
    if (user) run()
    return () => {
      ignore = true
    }
  }, [isCollector, user, t])

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      if (locationSocket) {
        if ((locationSocket as any).watchId) {
          navigator.geolocation.clearWatch((locationSocket as any).watchId)
        }
        locationSocket.disconnect()
      }
    }
  }, [locationSocket])

  async function acceptBarter(id: string) {
    try {
      setBusy(true)
      await http.post(`/api/barter/requests/${id}/accept`)
      // refresh incoming barter
      const res = await http.get('/api/barter/requests/me?incoming=true')
      setBarterIncoming((res.data.barterRequests || []).filter((br: any) => br?.status === 'pending'))
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_accept_barter'))
    } finally {
      setBusy(false)
    }
  }

  async function rejectBarter(id: string) {
    try {
      setBusy(true)
      await http.post(`/api/barter/requests/${id}/reject`)
      const res = await http.get('/api/barter/requests/me?incoming=true')
      setBarterIncoming((res.data.barterRequests || []).filter((br: any) => br?.status === 'pending'))
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_reject_barter'))
    } finally {
      setBusy(false)
    }
  }

  async function acceptWaste(id: string) {
    try {
      setBusy(true)
      const res = await http.post(`/api/collectors/requests/${id}/accept`)
      setCollectorRequests((prev) => prev.map((r) => (r._id === id ? res.data.wasteRequest : r)))
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_accept_request'))
    } finally {
      setBusy(false)
    }
  }

  async function rejectWaste(id: string) {
    try {
      setBusy(true)
      await http.post(`/api/collectors/requests/${id}/reject`)
      // Remove the rejected request from the dashboard view
      setCollectorRequests((prev) => prev.filter((r) => r._id !== id))
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_reject_request', 'Failed to reject request'))
    } finally {
      setBusy(false)
    }
  }

  async function completeWaste(id: string) {
    try {
      setBusy(true)
      const c = completion[id]
      if (!c) throw new Error(t('errors.missing_completion'))
      const res = await http.post(`/api/collectors/requests/${id}/complete`, {
        weightKg: c.weightKg,
        pricePerKg: c.pricePerKg,
      })
      if (res.data?.ok) {
        setCollectorRequests((prev) => prev.map((r) => (r._id === id ? { ...r, status: 'completed' } : r)))
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_complete_pickup'))
    } finally {
      setBusy(false)
    }
  }

  // Location tracking functions
  const startLocationTracking = async () => {
    if (!navigator.geolocation) {
      setError(t('errors.geolocation_unsupported'))
      return
    }

    try {
      setError(null)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        })
      })

      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      setCurrentLocation(coords)
      setIsTrackingLocation(true)

      // Connect to socket for location updates
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      
      if (!accessToken) {
        setError(t('errors.no_access_token'))
        return
      }

      const socket = io(baseURL, { auth: { token: accessToken } })
      setLocationSocket(socket)

      // Send initial location
      socket.emit('collector:location', coords)

      // Set up continuous tracking
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setCurrentLocation(newCoords)
          socket.emit('collector:location', newCoords)
        },
        (error) => {
          console.error('Location tracking error:', error)
          setError(t('errors.location_tracking_failed'))
          stopLocationTracking()
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      )

      // Store watchId for cleanup
      ;(socket as any).watchId = watchId

    } catch (e: any) {
      setError(e.message || t('errors.failed_start_tracking'))
    }
  }

  const stopLocationTracking = () => {
    setIsTrackingLocation(false)
    setCurrentLocation(null)
    
    if (locationSocket) {
      // Clear geolocation watch
      if ((locationSocket as any).watchId) {
        navigator.geolocation.clearWatch((locationSocket as any).watchId)
      }
      locationSocket.disconnect()
      setLocationSocket(null)
    }
  }

  if (!user) return null

  return (
    <div className="text-[var(--text-primary)]">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)]">{t('dashboard.title')}</h1>
          <div className="text-sm text-[var(--text-secondary)] mt-1">
            {isCollector ? t('dashboard.subtitle_collector') : t('dashboard.subtitle_user')}
          </div>
        </div>
        <div className="glass px-4 py-2 rounded-2xl border border-secondary-50/20 shadow-glass flex flex-col items-end">
          <span className="text-xs text-[var(--text-secondary)] font-medium tracking-wide uppercase">{t('dashboard.credits_header')}</span>
          <span className="text-xl text-accent font-black tracking-tight">{user.credits}</span>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4 text-accent mb-6 shadow-glow">{error}</div>}
      {busy && <div className="text-[var(--text-secondary)] text-sm mb-6 flex items-center gap-2"><div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>{t('common.working')}</div>}

      {isCollector ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/5 p-5">
            <h2 className="text-white font-semibold">{t('dashboard.incoming_waste')}</h2>
            <p className="text-sm text-white/60 mt-1">{t('dashboard.incoming_waste_hint')}</p>

            {collectorRequests.length === 0 ? (
              <div className="text-white/60 mt-4">{t('dashboard.no_requests')}</div>
            ) : (
              <div className="mt-4 space-y-3">
                {collectorRequests.map((r) => (
                  <div key={r._id} className="rounded-xl border border-black/5 dark:border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white font-semibold">{r.wasteType}</div>
                        <div className="text-xs text-white/60 mt-1">
                          {r.quantity}{t('common.kg')} • {r.date} • {r.timeSlot}
                        </div>
                        <div className="text-xs text-white/60 mt-2">
                          {t('common.status')}: <span className="text-emerald-200">{r.status}</span>
                        </div>
                      </div>
                      <div className="text-xs text-white/60 text-right">
                        {r.userId?.name || r.userId?._id}
                      </div>
                    </div>

                    {r.status === 'pending' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => acceptWaste(r._id)}
                          className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 transition-colors"
                        >
                          {t('common.accept')}
                        </button>
                        <button
                          onClick={() => rejectWaste(r._id)}
                          className="flex-1 rounded-xl border border-black/5 dark:border-white/10 bg-black/20 hover:bg-black/30 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-60 transition-colors"
                        >
                          {t('common.reject')}
                        </button>
                      </div>
                    )}

                    {r.status === 'accepted' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={completion[r._id]?.weightKg ?? ''}
                          onChange={(e) =>
                            setCompletion((prev) => ({
                              ...prev,
                              [r._id]: { weightKg: Number(e.target.value), pricePerKg: prev[r._id]?.pricePerKg ?? 0 },
                            }))
                          }
                          className="rounded-xl border border-black/5 dark:border-white/10 bg-black/30 px-3 py-2 outline-none text-sm"
                          placeholder={t('dashboard.weight_kg_placeholder')}
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={completion[r._id]?.pricePerKg ?? ''}
                          onChange={(e) =>
                            setCompletion((prev) => ({
                              ...prev,
                              [r._id]: { weightKg: prev[r._id]?.weightKg ?? 0, pricePerKg: Number(e.target.value) },
                            }))
                          }
                          className="rounded-xl border border-black/5 dark:border-white/10 bg-black/30 px-3 py-2 outline-none text-sm"
                          placeholder={t('dashboard.price_per_kg_placeholder')}
                        />
                        <button
                          onClick={() => completeWaste(r._id)}
                          className="col-span-2 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                        >
                          {t('dashboard.mark_complete')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/5 p-5">
            <h2 className="text-white font-semibold">{t('dashboard.earnings_tips')}</h2>
            <p className="text-sm text-white/60 mt-1">{t('dashboard.earnings_hint')}</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-black/5 dark:border-white/10 bg-black/20 p-4 text-sm text-[var(--text-secondary)]">
                <div className="text-white font-semibold">{t('dashboard.smart_matching')}</div>
                <div className="mt-1">{t('dashboard.smart_matching_desc')}</div>
              </div>
              <div className="rounded-xl border border-black/5 dark:border-white/10 bg-black/20 p-4 text-sm text-[var(--text-secondary)]">
                <div className="text-white font-semibold">{t('dashboard.live_tracking')}</div>
                <div className="mt-1">
                  {isTrackingLocation ? (
                    <div>
                      <div className="text-emerald-200 text-xs mb-2">
                        {t('dashboard.tracking_active')}
                        {currentLocation && (
                          <span className="ml-2">
                            ({currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={stopLocationTracking}
                        className="w-full rounded-lg bg-red-500/90 hover:bg-red-500 px-3 py-1 text-xs font-medium text-white"
                      >
                        {t('dashboard.stop_tracking')}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs mb-2">{t('dashboard.share_location_hint')}</div>
                      <button
                        onClick={startLocationTracking}
                        className="w-full rounded-lg bg-emerald-500/90 hover:bg-emerald-500 px-3 py-1 text-xs font-medium text-white"
                      >
                        {t('dashboard.start_tracking')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/5 p-5">
            <h2 className="text-white font-semibold">{t('dashboard.nav_map')}</h2>
            <p className="text-sm text-white/60 mt-1">{t('dashboard.nav_map_hint')}</p>
            <div className="mt-4">
              <CollectorNavigationMap
                wasteLocations={collectorRequests.map(r => ({
                  id: r._id,
                  location: r.location,
                  wasteType: r.wasteType,
                  quantity: r.quantity,
                  status: r.status,
                  userName: r.userId?.name || t('common.unknown')
                }))}
                currentLocation={currentLocation || undefined}
              />
              <div className="text-xs text-white/60 mt-2">
                {t('dashboard.map_legend')}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6">
            <h2 className="text-xl text-[var(--text-primary)] font-bold">{t('dashboard.activity')}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t('dashboard.activity_hint')}</p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass rounded-2xl p-5 hover:-translate-y-1 transition-transform border border-black/5 dark:border-white/10">
                <div className="text-xs text-secondary-50 font-medium tracking-wider uppercase mb-2">{t('auto.eco_score', `Eco Score`)}</div>
                <div className="text-3xl font-black text-white">{interestedItems.length * 10 + volunteerPoints}</div>
                <div className="mt-2 text-[10px] text-[var(--text-secondary)]">{t('auto.based_on_overall_activity', `Based on overall activity`)}</div>
              </div>
              <div className="glass rounded-2xl p-5 hover:-translate-y-1 transition-transform border border-black/5 dark:border-white/10">
                <div className="text-xs text-secondary-50 font-medium tracking-wider uppercase mb-2">{t('auto.active_pickups', `Active Pickups`)}</div>
                <div className="text-3xl font-black text-white">{wasteRequests.length}</div>
                <button className="mt-3 text-xs text-[var(--text-secondary)] hover:text-white underline transition-colors" onClick={() => navigate('/waste')}>
                  {t('dashboard.request_pickup')}
                </button>
              </div>
              <div className="glass rounded-2xl p-5 hover:-translate-y-1 transition-transform border border-black/5 dark:border-white/10">
                <div className="text-xs text-secondary-50 font-medium tracking-wider uppercase mb-2">{t('auto.earned_credits', `Earned Credits`)}</div>
                <div className="text-3xl font-black text-accent">{volunteerPoints}</div>
                <button className="mt-3 text-xs text-[var(--text-secondary)] hover:text-white underline transition-colors" onClick={() => navigate('/campaigns')}>
                  {t('dashboard.join_campaigns')}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-black/5 dark:border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">{t('dashboard.incoming_barter')}</div>
                  <div className="text-xs text-white/60 mt-1">{t('dashboard.incoming_barter_hint')}</div>
                </div>
                <div className="text-xs text-white/60">{t('dashboard.barter_count', { count: barterIncoming.length })}</div>
              </div>

              {barterIncoming.length === 0 ? (
                <div className="text-white/60 mt-3">{t('dashboard.no_barter')}</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {barterIncoming.slice(0, 4).map((br) => (
                    <div key={br._id} className="rounded-xl border border-black/5 dark:border-white/10 bg-white/5 p-3">
                      <div className="text-sm text-[var(--text-secondary)]">
                        {t('common.from')} <span className="text-emerald-200">{br.fromUser?.name}</span>
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        {t('dashboard.barter_offer')}: {br.offeredItem?.title} • {t('dashboard.barter_request')}: {br.requestedItem?.title}
                      </div>
                      <div className="text-xs text-white/60 mt-2">
                        {t('dashboard.extra_credits')}: <span className="text-emerald-200">{br.credits}</span>
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        {t('common.status')}: <span className="text-emerald-200">{br.status}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          disabled={busy || br.status !== 'pending'}
                          onClick={() => acceptBarter(br._id)}
                          className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                        >
                          {t('common.accept')}
                        </button>
                        <button
                          disabled={busy || br.status !== 'pending'}
                          onClick={() => rejectBarter(br._id)}
                          className="flex-1 rounded-xl border border-black/5 dark:border-white/10 bg-black/20 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-black/30 disabled:opacity-60"
                        >
                          {t('common.reject')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-xl text-[var(--text-primary)] font-bold">{t('dashboard.my_stuff')}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t('dashboard.my_stuff_hint')}</p>

            <div className="mt-6 space-y-3">
              {myItems.slice(0, 5).map((it) => (
                <div key={it._id} className="glass rounded-xl p-4 border border-black/5 dark:border-white/10 hover:border-black/5 dark:border-white/20 transition-colors">
                  <div className="text-sm text-white font-semibold">{it.title}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1 flex justify-between">
                    <span>{it.price} {t('common.credits_word')} • {it.status}</span>
                    <button
                      onClick={() => navigate(`/items/${it._id}`)}
                      className="text-secondary-50 hover:underline"
                    >
                      {t('dashboard.view_details')}
                    </button>
                  </div>
                </div>
              ))}
              {myItems.length === 0 && <div className="text-[var(--text-secondary)] text-sm">{t('dashboard.no_items')}</div>}
            </div>

            <div className="mt-8">
              <h3 className="text-white font-bold text-sm mb-3">{t('auto.recent_activity', `Recent Activity`)}</h3>
              <div className="space-y-3">
                {tx.slice(0, 6).map((t) => (
                  <div key={t._id} className="text-xs text-[var(--text-secondary)] flex items-center justify-between glass rounded-xl border border-black/5 dark:border-white/10 px-4 py-3 hover:bg-white/10 transition-colors">
                    <span className="capitalize">{t.type.replace('_', ' ')}</span>
                    <span className="text-accent font-bold">+{t.credits}</span>
                  </div>
                ))}
                {tx.length === 0 && <div className="text-[var(--text-secondary)] text-sm">{t('dashboard.no_wallet_activity')}</div>}
              </div>
            </div>
            
            <div className="mt-8">
              <h3 className="text-white font-bold text-sm mb-3">{t('auto.active_campaigns', `Active Campaigns`)}</h3>
              <div className="space-y-3">
                {volunteerActivities.slice(0, 4).map((a) => (
                  <button
                    key={a.campaignId}
                    onClick={() => navigate(`/campaigns/${a.campaignId}`)}
                    className="w-full text-left glass rounded-xl border border-black/5 dark:border-white/10 px-4 py-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm text-white font-semibold truncate">{a.title}</div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                          {a.status}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-accent font-bold">
                          {a.pointsGained > 0 ? `+${a.pointsGained} cr` : '—'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {volunteerActivities.length === 0 && <div className="text-[var(--text-secondary)] text-sm">{t('dashboard.no_volunteer')}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

