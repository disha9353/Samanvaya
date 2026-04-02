import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'

import { http } from '../api/http'

const schema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  price: z.number().min(0),
})

type FormValues = z.infer<typeof schema>

export default function CreateItemPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [locState, setLocState] = useState<'fetching' | 'pinned' | 'denied' | 'unsupported' | 'idle'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', price: 0 },
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocState('unsupported')
      return
    }
    setLocState('fetching')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocState('pinned')
      },
      (err) => {
        console.warn('Geolocation failed:', err)
        setLocState('denied')
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }, [])

  async function uploadImages() {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    const res = await http.post('/api/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.urls as string[]
  }

  async function onSubmit(values: FormValues) {
    try {
      setBusy(true)
      setError(null)
      if (files.length === 0) {
        setError(t('errors.image_required'))
        setBusy(false)
        return
      }

      const images = await uploadImages()

      await http.post('/api/items', {
        title: values.title,
        description: values.description || '',
        images,
        price: values.price,
        location: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
      })
      navigate('/feed')
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || t('errors.failed_create_item'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-white">{t('item.create.title')}</h1>
        <p className="text-sm text-white/60 mt-2">{t('item.create.subtitle')}</p>
      </div>

      <form
        className="rounded-2xl border border-white/10 bg-white/5 p-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <label className="block text-xs text-white/70 mb-2">{t('item.create.title_label')}</label>
        <input
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60 mb-2"
          {...register('title')}
          placeholder={t('item.create.title_ph')}
        />
        {errors.title && <div className="text-xs text-red-300 mb-2">{errors.title.message}</div>}

        <label className="block text-xs text-white/70 mb-2 mt-3">{t('item.create.desc_label')}</label>
        <textarea
          className="w-full min-h-[90px] rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60 mb-2"
          {...register('description')}
          placeholder={t('item.create.desc_ph')}
        />
        {errors.description && <div className="text-xs text-red-300 mb-2">{errors.description.message}</div>}

        <label className="block text-xs text-white/70 mb-2 mt-3">{t('item.create.price_label')}</label>
        <input
          type="number"
          min={0}
          step={1}
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60 mb-2"
          {...register('price', { valueAsNumber: true })}
        />
        {errors.price && <div className="text-xs text-red-300 mb-2">{errors.price.message}</div>}

        <label className="block text-xs text-white/70 mb-2 mt-3">{t('item.create.images_label')}</label>
        <input
          type="file"
          multiple
          accept="image/*"
          className="w-full text-white/70"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        <div className="text-xs text-white/60 mt-1">{t('item.create.images_hint')}</div>

        <div className="mt-4 flex items-center gap-2 text-xs">
          {locState === 'fetching' && <span className="text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-md">{t('item.create.loc_fetching', 'Fetching live location...')}</span>}
          {locState === 'pinned' && <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">📍 {t('item.create.loc_pinned', 'Location pinned')}</span>}
          {locState === 'denied' && <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded-md">{t('item.create.loc_denied', 'Location access denied')}</span>}
          {locState === 'unsupported' && <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded-md">{t('item.create.loc_unsupported', 'Location not supported')}</span>}
        </div>

        {error && <div className="text-sm text-red-200 mt-3">{error}</div>}

        <button
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? t('item.create.posting') : t('item.create.post')}
        </button>
      </form>
    </div>
  )
}
