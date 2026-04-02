import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Package, Cpu, FileText, Wine, MapPin, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react'

import type { RootState } from '../store/types'
import { http } from '../api/http'
import LocationPicker, { type LatLng } from '../components/maps/LocationPicker'
import LivePickupMap from '../components/maps/LivePickupMap'
import { io, type Socket } from 'socket.io-client'

type WasteRequest = {
  _id: string
  wasteType: string
  quantity: number
  location: { lat: number; lng: number }
  date: string
  timeSlot: string
  status: string
  collectorId?: { _id: string; name: string }
}

type CollectorLocation = {
  collectorId: string
  lat: number
  lng: number
}

const WASTE_TYPE_DEFS = [
  { value: 'plastic', icon: Package, color: 'text-blue-500' },
  { value: 'metal', icon: Trash2, color: 'text-gray-500' },
  { value: 'ewaste', icon: Cpu, color: 'text-purple-500' },
  { value: 'paper', icon: FileText, color: 'text-green-500' },
  { value: 'glass', icon: Wine, color: 'text-cyan-500' },
] as const

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center">
          <motion.div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i < current
                ? 'bg-secondary-500 text-white'
                : i === current
                ? 'bg-primary-500 text-white'
                : 'bg-white/50 text-secondary-600'
            }`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </motion.div>
          {i < total - 1 && <div className="w-8 h-0.5 bg-white/30 mx-2" />}
        </div>
      ))}
    </div>
  )
}

export default function WastePickupPage() {
  const { t } = useTranslation()
  const user = useSelector((s: RootState) => s.auth.user)
  const accessToken = useSelector((s: RootState) => s.auth.accessToken)
  const [currentStep, setCurrentStep] = useState(0)
  const [wasteType, setWasteType] = useState('plastic')
  const [quantity, setQuantity] = useState(1)
  const [address] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [timeSlot, setTimeSlot] = useState('10:00-11:00')
  const [location, setLocation] = useState<LatLng>({ lat: 28.6139, lng: 77.209 })

  const [requests, setRequests] = useState<WasteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [collectors, setCollectors] = useState<CollectorLocation[]>([])

  useEffect(() => {
    let ignore = false
    async function run() {
      if (!user || !accessToken) {
        if (!ignore) setLoading(false)
        return
      }
      try {
        setLoading(true)
        const res = await http.get('/api/waste/requests/me')
        if (ignore) return
        setRequests(res.data.requests || [])
      } catch (e: any) {
        if (ignore) return
        setError(e?.response?.data?.message || e.message || t('waste.errors.load_failed'))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [user, accessToken, t])

  useEffect(() => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
    if (!user || !accessToken) return

    const socket: Socket = io(baseURL, { auth: { token: accessToken } })
    socket.on('collector:location:update', (payload: { collectorId: string; lat: number; lng: number }) => {
      setCollectors((prev) => {
        const next = [...prev]
        const idx = next.findIndex((c) => c.collectorId === payload.collectorId)
        if (idx >= 0) next[idx] = payload
        else next.push(payload)
        return next
      })
    })
    return () => {
      socket.disconnect()
    }
  }, [user, accessToken])

  const acceptedRequest = requests.find((r) => r.status === 'accepted')
  const assignedCollectorId = acceptedRequest?.collectorId?._id

  const latestPickupLocation = useMemo<LatLng>(() => {
    if (acceptedRequest) return acceptedRequest.location
    if (requests.length > 0) return requests[0].location
    return location
  }, [requests, location, acceptedRequest])

  async function useCurrentLocation() {
    try {
      setError(null)
      if (!navigator.geolocation) {
        setError(t('waste.errors.geo_unsupported'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        () => setError(t('waste.errors.geo_denied'))
      )
    } catch (e: any) {
      setError(e.message || t('waste.errors.location_failed'))
    }
  }

  async function submit() {
    if (!user) return
    if (user.role === 'collector') {
      setError(t('waste.errors.collector_only'))
      return
    }
    try {
      setBusy(true)
      setError(null)
      const res = await http.post('/api/waste/requests', {
        wasteType,
        quantity,
        location,
        date,
        timeSlot,
        address,
      })
      setRequests((prev) => [res.data.wasteRequest, ...prev])
      setCurrentStep(0)
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('waste.errors.submit_failed'))
    } finally {
      setBusy(false)
    }
  }

  const steps = useMemo(
    () => [
      {
        title: t('waste.step_type'),
        content: (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WASTE_TYPE_DEFS.map((type) => {
              const Icon = type.icon
              return (
                <motion.button
                  key={type.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setWasteType(type.value)}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    wasteType === type.value
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-primary-200/30 bg-primary-50/50 hover:bg-primary-50/70'
                  }`}
                >
                  <Icon className={`w-12 h-12 mx-auto mb-3 ${type.color}`} />
                  <div className="text-lg font-semibold text-primary-900 dark:text-white">
                    {t(`waste.type.${type.value}`)}
                  </div>
                </motion.button>
              )
            })}
          </div>
        ),
      },
      {
        title: t('waste.step_qty_loc'),
        content: (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-white mb-2">{t('waste.qty_label')}</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-xl border border-white/20 bg-white/70 dark:bg-black/30 px-4 py-3 outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-white mb-2">{t('waste.loc_label')}</label>
              <LocationPicker value={location} onChange={setLocation} />
              <button
                type="button"
                onClick={useCurrentLocation}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-black/30 hover:bg-white/70 dark:hover:bg-black/50 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                {t('waste.use_current_loc')}
              </button>
            </div>
          </div>
        ),
      },
      {
        title: t('waste.step_datetime'),
        content: (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-white mb-2">{t('waste.date_label')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/70 dark:bg-black/30 px-4 py-3 outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-white mb-2">{t('waste.time_label')}</label>
              <input
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                placeholder={t('waste.time_ph')}
                className="w-full rounded-xl border border-white/20 bg-white/70 dark:bg-black/30 px-4 py-3 outline-none focus:border-primary-400"
              />
            </div>
          </div>
        ),
      },
      {
        title: t('waste.step_confirm'),
        content: (
          <div className="space-y-4">
            <div className="bg-white/50 dark:bg-black/30 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-primary-900 dark:text-white mb-4">{t('waste.summary_title')}</h3>
              <div className="space-y-2 text-sm text-primary-900 dark:text-white/90">
                <div>
                  <strong>{t('waste.summary_type')}:</strong> {t(`waste.type.${wasteType}`)}
                </div>
                <div>
                  <strong>{t('waste.summary_qty')}:</strong> {quantity} {t('waste.kg')}
                </div>
                <div>
                  <strong>{t('waste.summary_date')}:</strong> {date}
                </div>
                <div>
                  <strong>{t('waste.summary_time')}:</strong> {timeSlot}
                </div>
                <div>
                  <strong>{t('waste.summary_loc')}:</strong> {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </div>
              </div>
            </div>
            {error && <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl">{error}</div>}
          </div>
        ),
      },
    ],
    [t, wasteType, quantity, location, date, timeSlot, error]
  )

  if (!user) {
    return (
      <div className="min-h-screen bg-primary-50 dark:bg-dark-bg p-4 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white/70 dark:bg-black/50 backdrop-blur-md rounded-3xl p-8 shadow-glass">
            <h1 className="text-3xl font-bold text-primary-900 dark:text-white mb-4">{t('waste.title')}</h1>
            <p className="text-secondary-600 dark:text-white/60 mb-6">{t('waste.hero_subtitle')}</p>
            <p className="text-secondary-600 dark:text-white/60 mb-6">{t('waste.login_prompt')}</p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-primary-500 text-white rounded-full font-semibold hover:bg-primary-600 transition-colors"
            >
              {t('waste.log_in')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-dark-bg p-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/70 dark:bg-black/50 backdrop-blur-md rounded-3xl p-8 shadow-glass">
            <h1 className="text-3xl font-bold text-primary-900 dark:text-white mb-2">{t('waste.title')}</h1>
            <p className="text-secondary-600 dark:text-white/60 mb-6">{t('waste.hero_subtitle')}</p>

            <StepIndicator current={currentStep} total={steps.length} />

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-semibold text-primary-900 dark:text-white mb-6">{steps[currentStep].title}</h2>
                {steps[currentStep].content}
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-between mt-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="flex items-center gap-2 px-6 py-3 bg-white/50 dark:bg-black/30 hover:bg-white/70 dark:hover:bg-black/50 rounded-xl font-medium disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('common.back')}
              </motion.button>

              {currentStep < steps.length - 1 ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium"
                >
                  {t('common.next')}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={submit}
                  disabled={busy}
                  className="flex items-center gap-2 px-6 py-3 bg-secondary-500 hover:bg-secondary-600 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {busy ? t('waste.requesting') : t('waste.request_pickup')}
                  <CheckCircle className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/70 dark:bg-black/50 backdrop-blur-md rounded-2xl p-6 shadow-glass">
              <h2 className="text-xl font-semibold text-primary-900 dark:text-white mb-4">{t('waste.my_requests')}</h2>
              {loading ? (
                <div className="animate-pulse text-secondary-600 dark:text-white/60">{t('common.loading')}</div>
              ) : requests.length === 0 ? (
                <div className="text-secondary-600 dark:text-white/60">{t('waste.no_requests')}</div>
              ) : (
                <div className="space-y-3">
                  {requests.slice(0, 5).map((r) => (
                    <div key={r._id} className="bg-white/50 dark:bg-black/30 p-4 rounded-xl border border-white/20 dark:border-white/10">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-primary-900 dark:text-white">
                            {t(`waste.type.${r.wasteType}`, { defaultValue: r.wasteType })}
                          </div>
                          <div className="text-sm text-secondary-600 dark:text-white/60">
                            {r.quantity} {t('waste.kg')} • {r.date} • {r.timeSlot}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            r.status === 'completed'
                              ? 'bg-secondary-500/20 text-secondary-700 dark:text-secondary-300'
                              : r.status === 'accepted'
                              ? 'bg-primary-500/20 text-primary-700 dark:text-primary-300'
                              : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                          }`}
                        >
                          {t(`waste.status.${r.status}`, { defaultValue: r.status })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-primary-50/70 dark:bg-black/50 backdrop-blur-md rounded-2xl p-6 shadow-glass">
              <h3 className="text-lg font-semibold text-primary-900 dark:text-white mb-4">
                {acceptedRequest ? t('waste.live_tracking') : t('waste.live_map')}
              </h3>
              <LivePickupMap pickupLocation={latestPickupLocation} collectors={collectors} assignedCollectorId={assignedCollectorId} />
              <div className="text-xs text-secondary-600 dark:text-white/60 mt-2">
                {acceptedRequest
                  ? t('waste.map_hint_assigned', {
                      name: acceptedRequest.collectorId?.name || t('waste.unknown'),
                    })
                  : t('waste.map_hint_default')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
