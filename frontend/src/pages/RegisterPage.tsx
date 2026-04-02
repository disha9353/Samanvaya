import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { register } from '../store/authSlice'
import type { RootState } from '../store/types'

const schema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['user', 'collector']).optional(),
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const { t } = useTranslation()
  const dispatch = useDispatch<any>()
  const navigate = useNavigate()
  const user = useSelector((s: RootState) => s.auth.user)
  const authStatus = useSelector((s: RootState) => s.auth.status)
  const authError = useSelector((s: RootState) => s.auth.error)

  const {
    register: rhRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'user' },
  })

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-white">{t('auth.register_title')}</h1>
        <p className="text-sm text-white/60 mt-2">{t('auth.register_subtitle', { credits: t('auth.register_credits_highlight') })}</p>
      </div>

      <form
        className="rounded-2xl border border-white/10 bg-white/5 p-5"
        onSubmit={handleSubmit((v) => dispatch(register(v)))}
      >
        <label className="block text-xs text-white/70 mb-2">{t('auth.name')}</label>
        <input
          className="w-full mb-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
          {...rhRegister('name')}
        />
        {errors.name && <div className="text-xs text-red-300 mb-2">{errors.name.message}</div>}

        <label className="block text-xs text-white/70 mb-2 mt-3">{t('auth.email')}</label>
        <input
          className="w-full mb-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
          {...rhRegister('email')}
        />
        {errors.email && <div className="text-xs text-red-300 mb-2">{errors.email.message}</div>}

        <label className="block text-xs text-white/70 mb-2 mt-3">{t('auth.password')}</label>
        <input
          type="password"
          className="w-full mb-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
          {...rhRegister('password')}
        />
        {errors.password && <div className="text-xs text-red-300 mb-2">{errors.password.message}</div>}

        <label className="block text-xs text-white/70 mb-2 mt-3">{t('auth.i_am_a')}</label>
        <select
          className="w-full mb-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-emerald-400/60"
          {...rhRegister('role')}
        >
          <option value="user">{t('auth.role_user')}</option>
          <option value="collector">{t('auth.role_collector')}</option>
        </select>

        {authError && <div className="text-sm text-red-200 mt-3">{authError}</div>}

        <button
          disabled={authStatus === 'loading'}
          className="mt-4 w-full rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {authStatus === 'loading' ? t('auth.creating') : t('auth.create_account')}
        </button>
      </form>

      <div className="text-sm text-white/70 mt-4">
        {t('auth.have_account')}{' '}
        <Link className="text-emerald-200 hover:underline" to="/login">
          {t('auth.sign_in_link')}
        </Link>
      </div>
    </div>
  )
}

