import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { login } from '../store/authSlice'
import type { RootState } from '../store/types'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

type FormValues = z.infer<typeof schema>

import OtpInput from '../components/common/OtpInput'

export default function LoginPage() {
  const { t } = useTranslation()
  const dispatch = useDispatch<any>()
  const navigate = useNavigate()
  const user = useSelector((s: RootState) => s.auth.user)
  const authStatus = useSelector((s: RootState) => s.auth.status)
  const authError = useSelector((s: RootState) => s.auth.error)

  const [step, setStep] = useState<'LOGIN' | 'OTP'>('LOGIN')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')

  const {
    register: rhRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    }
  }, [user, navigate])

  const onLoginSubmit = async (v: FormValues) => {
    try {
      const result = await dispatch(login(v)).unwrap()
      if (result.status === 'OTP_REQUIRED') {
        setFormEmail(v.email)
        setFormPassword(v.password)
        setStep('OTP')
      }
    } catch (err) {
      // errors handled by redux store
    }
  }

  // --- OTP Verification State ---
  const [otpToken, setOtpToken] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)

  const verifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setOtpError('')
    setOtpLoading(true)
    try {
      const { http } = await import('../api/http')
      const { setAuth } = await import('../store/authSlice')
      const res = await http.post('/api/auth/verify-otp', { email: formEmail, otp: otpToken })
      dispatch(setAuth({ user: res.data.user, accessToken: res.data.accessToken, refreshToken: res.data.refreshToken }))
    } catch (err: any) {
      setOtpError(err.response?.data?.error || t('errors.failed_verify_otp'))
    } finally {
      setOtpLoading(false)
    }
  }

  const resendOtp = async () => {
    setOtpError('')
    try {
      // resend by triggering login action again which dispatches OTP
      await dispatch(login({ email: formEmail, password: formPassword })).unwrap()
    } catch (err: any) {
      setOtpError(t('errors.failed_resend_otp'))
    }
  }

  if (step === 'OTP') {
    return (
      <OtpInput 
        value={otpToken}
        onChange={setOtpToken}
        onSubmit={verifyOtp}
        onResend={resendOtp}
        isLoading={otpLoading}
        error={otpError}
        email={formEmail}
      />
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-white">{t('auth.welcome')}</h1>
        <p className="text-sm text-white/60 mt-2">{t('auth.login_subtitle')}</p>
      </div>

      <form
        className="rounded-2xl border border-white/10 bg-white/5 p-5"
        onSubmit={handleSubmit(onLoginSubmit)}
      >
        <label className="block text-xs text-white/70 mb-2">{t('auth.email')}</label>
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

        {authError && <div className="text-sm text-red-200 mt-3">{authError}</div>}

        <button
          disabled={authStatus === 'loading'}
          className="mt-4 w-full rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {authStatus === 'loading' ? t('auth.signing_in') : t('auth.sign_in')}
        </button>
      </form>

      <div className="text-sm text-white/70 mt-4">
        {t('auth.no_account')}{' '}
        <Link className="text-emerald-200 hover:underline" to="/register">
          {t('auth.create_one')}
        </Link>
      </div>
    </div>
  )
}

