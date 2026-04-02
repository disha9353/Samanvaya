import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import LocationPicker, { type LatLng } from '../components/maps/LocationPicker'
import { http } from '../api/http'
import { createCampaign } from '../store/campaignsSlice'

const CREDITS_PER_HOUR = 50

const schema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(4000),
  category: z.string().min(2).max(60),
  location: z.string().min(2).max(140),
  dateTime: z.string().min(1),
  maxParticipants: z.number().min(1).max(100000),
  durationHours: z.number().min(0.5).max(720),
})

type FormValues = z.infer<typeof schema>

export default function CreateCampaignPage() {
  const { t } = useTranslation()
  const dispatch = useDispatch<any>()
  const navigate = useNavigate()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coords, setCoords] = useState<LatLng>({ lat: 28.6139, lng: 77.209 })

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'Cleanup',
      maxParticipants: 100,
      durationHours: 2,
    },
  })

  async function uploadImageIfAny() {
    if (!imageFile) return null
    const form = new FormData()
    form.append('files', imageFile)
    const res = await http.post('/api/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const urls = res.data.urls as string[]
    return urls?.[0] || null
  }

  async function onSubmit(values: FormValues) {
    try {
      setBusy(true)
      setError(null)
      const imageUrl = await uploadImageIfAny()

      const payload = {
        title: values.title,
        description: values.description,
        category: values.category,
        location: values.location,
        coordinates: coords,
        dateTime: values.dateTime,
        maxParticipants: values.maxParticipants,
        durationHours: values.durationHours,
        imageUrl,
      }

      const action = await dispatch(createCampaign(payload))
      const created = action?.payload
      if (created?._id) navigate(`/campaigns/${created._id}`)
      else navigate('/campaigns')
    } catch (e: any) {
      let errMsg = e?.response?.data?.error || e?.response?.data?.message || e.message || t('errors.failed_create_campaign')
      if (e?.response?.data?.details) {
         errMsg += ': ' + JSON.stringify(e.response.data.details);
      }
      setError(errMsg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-white">{t('campaign.create.title')}</h1>
        <p className="text-sm text-white/60 mt-2">{t('campaign.create.subtitle')}</p>
      </div>

      <form className="rounded-2xl border border-white/10 bg-white/5 p-5" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-white/70 mb-2">{t('campaign.create.f_title')}</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
              {...register('title')}
              placeholder={t('campaign.create.f_title_ph')}
            />
            {errors.title && <div className="text-xs text-red-300 mt-1">{errors.title.message}</div>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-white/70 mb-2">{t('campaign.create.f_description')}</label>
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
              {...register('description')}
              placeholder={t('campaign.create.f_description_ph')}
            />
            {errors.description && <div className="text-xs text-red-300 mt-1">{errors.description.message}</div>}
          </div>

          <div>
            <label className="block text-xs text-white/70 mb-2">{t('campaign.create.f_category')}</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
              {...register('category')}
              placeholder={t('campaign.create.f_category_ph')}
            />
            {errors.category && <div className="text-xs text-red-300 mt-1">{errors.category.message}</div>}
          </div>

          <div>
            <label className="block text-xs text-white/70 mb-2">{t('campaign.create.f_location')}</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
              {...register('location')}
              placeholder={t('campaign.create.f_location_ph')}
            />
            {errors.location && <div className="text-xs text-red-300 mt-1">{errors.location.message}</div>}
          </div>

          <div>
            <label className="block text-xs text-white/70 mb-2">{t('campaign.create.f_datetime')}</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
              {...register('dateTime')}
            />
            {errors.dateTime && <div className="text-xs text-red-300 mt-1">{errors.dateTime.message}</div>}
          </div>

          <div>
            <label className="block text-xs text-white/70 mb-2">{t('campaign.create.f_max_participants')}</label>
            <input
              type="number"
              min={1}
              step={1}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
              {...register('maxParticipants', { valueAsNumber: true })}
            />
            {errors.maxParticipants && <div className="text-xs text-red-300 mt-1">{errors.maxParticipants.message}</div>}
          </div>

          <div>
            <label className="block text-xs text-white/70 mb-2">{t('auto.campaign_duration_hours', `⏱ Campaign Duration (hours)`)}</label>
            <input
              id="durationHours"
              type="number"
              min={0.5}
              max={720}
              step={0.5}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
              {...register('durationHours', { valueAsNumber: true })}
            />
            {errors.durationHours && <div className="text-xs text-red-300 mt-1">{errors.durationHours.message}</div>}
          </div>

          {/* Live credit preview */}
          <div className="sm:col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="text-xs text-emerald-300/70">{t('auto.credits_per_participant', `Credits per participant`)}</div>
              <div className="text-lg font-bold text-emerald-300">
                {t('auto.you_will_earn', `You will earn`)} {Math.round((watch('durationHours') || 0) * CREDITS_PER_HOUR)} {t('auto.credits', `credits`)}
                                            </div>
              <div className="text-[11px] text-white/50">
                {watch('durationHours') || 0}{t('auto.h', `h ×`)} {CREDITS_PER_HOUR} {t('auto.credits_hour', `credits/hour`)}
                                            </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <LocationPicker value={coords} onChange={setCoords} />

          {/* Manual lat/lng inputs */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-white/70 mb-1">{t('auto.latitude', `📍 Latitude`)}</label>
              <input
                id="coord-lat"
                type="number"
                step="any"
                min={-90}
                max={90}
                value={coords.lat}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val) && val >= -90 && val <= 90) setCoords(c => ({ ...c, lat: val }))
                }}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                placeholder={t('auto.placeholder_e_g_28_6139', `e.g. 28.6139`)}
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">{t('auto.longitude', `📍 Longitude`)}</label>
              <input
                id="coord-lng"
                type="number"
                step="any"
                min={-180}
                max={180}
                value={coords.lng}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val) && val >= -180 && val <= 180) setCoords(c => ({ ...c, lng: val }))
                }}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                placeholder={t('auto.placeholder_e_g_77_2090', `e.g. 77.2090`)}
              />
            </div>
          </div>
          <div className="text-xs text-white/40 mt-2">
            {t('auto.you_can_drag_the_map_pin', `📌 You can drag the map pin`)} <strong>{t('auto.or', `or`)}</strong> {t('auto.type_coordinates_above_they_st', `type coordinates above — they stay in sync.`)}
                                </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs text-white/70 mb-2">{t('campaign.create.image_label')}</label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-white/70"
            onChange={(e) => setImageFile((e.target.files || [])[0] || null)}
          />
        </div>

        {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-100 mt-4">{error}</div>}

        <button
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? t('campaign.create.creating') : t('campaign.create.submit')}
        </button>
      </form>
    </div>
  )
}

