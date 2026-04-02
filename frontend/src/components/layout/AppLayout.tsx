import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Moon, Sun, Home, User, Plus, CreditCard, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { RootState } from '../../store/types'
import { logout } from '../../store/authSlice'
import { http } from '../../api/http'
import { useTheme } from '../../contexts/ThemeContext'
import Chatbot from '../Chatbot'
import { NotificationBell } from './NotificationBell'

export default function AppLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const user = useSelector((s: RootState) => s.auth.user)
  const isAdmin = user?.role === 'admin'
  const accessToken = useSelector((s: RootState) => s.auth.accessToken)
  const dispatch = useDispatch()
  const nav = useNavigate()
  const location = useLocation()
  const [unreadMsgs, setUnreadMsgs] = useState(0)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const isChatRoute = useMemo(() => location.pathname.startsWith('/chat'), [location.pathname])

  useEffect(() => {
    let alive = true

    async function refreshUnread() {
      if (!user) {
        if (alive) setUnreadMsgs(0)
        return
      }
      if (!accessToken) return
      try {
        const res = await http.get('/api/notifications', {
          params: { unread: 1 },
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const items = res.data.notifications || []
        const count = items.filter((n: any) => n?.type === 'message_received' && n?.isRead === false).length
        if (alive) setUnreadMsgs(count)
      } catch (err: any) {
        if (err?.response?.status === 401) {
          // Token expired — silently redirect (expected behavior, not a real error)
          dispatch(logout())
          nav('/login')
        }
        // Silently ignore network/other errors during background polling
      }
    }

    refreshUnread()
    const t = setInterval(refreshUnread, 8000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [user, accessToken])

  useEffect(() => {
    // When user opens chat, clear message notifications.
    async function clearChatUnread() {
      if (!user) return
      if (!isChatRoute) return
      if (unreadMsgs <= 0) return
      if (!accessToken) return
      try {
        await http.post(
          '/api/notifications/read-all',
          { type: 'message_received' },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        setUnreadMsgs(0)
      } catch (err: any) {
        if (err?.response?.status === 401) {
          dispatch(logout())
          nav('/login')
        }
      }
    }
    clearChatUnread()
  }, [isChatRoute, user, unreadMsgs])

  useEffect(() => {
    setIsMoreOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen transition-colors duration-500">
      <header className="sticky top-0 z-50 border-b border-black/5 dark:border-white/10 shadow-sm transition-all duration-300" style={{background: 'var(--glass-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)'}}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-2">
          <Link to="/" className="flex flex-col group" aria-label={t('auto.aria-label_samanvaya_the_waves_of_change', `Samanvaya - the waves of change`)}>
            <span className="text-2xl font-black tracking-tighter text-[var(--text-primary)] group-hover:text-primary-500 transition-colors duration-300">
              {t('auto.samanvaya', `Samanvaya`)}
                                      </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-70 -mt-0.5 group-hover:opacity-100 transition-colors duration-300">
              {t('auto.the_waves_of_change', `the waves of change`)}
                                      </span>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium flex-1 ml-12">
            {isAdmin ? (
              <Link className="opacity-80 hover:opacity-100 hover:text-secondary-500 relative group transition-colors" to="/admin">
                {t('admin_dashboard')}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-secondary-500 transition-all group-hover:w-full"></span>
              </Link>
            ) : (
              <>
                <Link className="opacity-80 hover:opacity-100 hover:text-secondary-500 relative group transition-colors" to={user ? '/feed' : '/'}>
                  {t('home')}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-secondary-500 transition-all group-hover:w-full"></span>
                </Link>
                <Link className="opacity-80 hover:opacity-100 hover:text-secondary-500 relative group transition-colors" to="/campaigns">
                  {t('campaigns')}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-secondary-500 transition-all group-hover:w-full"></span>
                </Link>
                
                <Link className="opacity-80 hover:opacity-100 hover:text-secondary-500 relative group transition-colors" to="/reports">
                  {t('auto.reports', `Reports`)}
                                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-secondary-500 transition-all group-hover:w-full"></span>
                </Link>
                <Link className="opacity-80 hover:opacity-100 hover:text-secondary-500 relative group transition-colors" to="/dashboard">
                  {t('dashboard')}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-secondary-500 transition-all group-hover:w-full"></span>
                </Link>
                <Link className="opacity-80 hover:opacity-100 hover:text-secondary-500 relative group transition-colors" to="/profile">
                  {t('profile')}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-secondary-500 transition-all group-hover:w-full"></span>
                </Link>
              </>
            )}

            {!isAdmin && (
              <div className="relative">
                <button 
                  className="opacity-80 hover:opacity-100 focus:outline-none transition-colors"
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                >
                  {t('more')}
                </button>
                {isMoreOpen && (
                  <div className="absolute right-0 mt-3 w-48 rounded-2xl glass-card overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Link 
                      className="block px-4 py-3 text-sm hover:bg-black/10 transition-colors" 
                      to="/chat"
                      onClick={() => setIsMoreOpen(false)}
                    >
                      {t('chat')}
                      {unreadMsgs > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-accent text-white text-[10px] px-2 py-0.5 shadow-sm">
                          {unreadMsgs}
                        </span>
                      )}
                    </Link>
                    <Link 
                      className="block px-4 py-3 text-sm hover:bg-black/10 transition-colors" 
                      to="/reports/new"
                      onClick={() => setIsMoreOpen(false)}
                    >
                      {t('auto.report_pollution', `Report Pollution`)}
                                                              </Link>
                    <Link 
                      className="block px-4 py-3 text-sm hover:bg-black/10 transition-colors" 
                      to="/waste"
                      onClick={() => setIsMoreOpen(false)}
                    >
                      {t('waste_pickup')}
                    </Link>
                    <Link 
                      className="block px-4 py-3 text-sm hover:bg-black/10 transition-colors" 
                      to="/wallet"
                      onClick={() => setIsMoreOpen(false)}
                    >
                      {t('wallet')}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={i18n.resolvedLanguage || 'en'}
              onChange={(e) => {
                i18n.changeLanguage(e.target.value);
                localStorage.setItem('i18nextLng', e.target.value);
              }}
              className="bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 border border-black/10 dark:border-white/20 text-xs rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer transition-colors"
            >
              <option value="en" className="text-black">{t('auto.en', `En`)}</option>
              <option value="hi" className="text-black">{t('auto.hi', `Hi`)}</option>
              <option value="kn" className="text-black">{t('auto.kn', `Kn`)}</option>
            </select>
            
            {user && !isAdmin && <NotificationBell />}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full glass hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0 shadow-sm"
              title={t('auto.title_toggle_theme', `Toggle Theme`)}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-yellow-400" />}
            </button>
            {user ? (
              <div className="flex items-center gap-3 ml-2">
                {!isAdmin && (
                  <div className="hidden sm:flex flex-col items-end leading-tight text-xs">
                    <span className="opacity-60 uppercase tracking-wider text-[10px]">{t('layout.credits_label')}</span>
                    <span className="text-accent font-black tracking-tight">{user.credits}</span>
                  </div>
                )}
                <button
                  className="rounded-xl glass px-4 py-2 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors border-white/20"
                  onClick={() => {
                    dispatch(logout())
                    nav('/login')
                  }}
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <Link className="rounded-xl glass px-5 py-2 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10 shadow-sm transition-transform hover:scale-105 border-white/20 ml-2" to="/login">
                {t('login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">{children}</main>

      {/* Mobile Bottom Navigation */}
      {user && !isAdmin && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t z-40 pb-safe">
          <div className="flex items-center justify-around py-3">
            <Link to="/feed" className="flex flex-col items-center p-2 opacity-70 hover:opacity-100 hover:text-secondary-500 transition-colors">
              <Home className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">{t('feed')}</span>
            </Link>
            <Link to="/dashboard" className="flex flex-col items-center p-2 opacity-70 hover:opacity-100 hover:text-secondary-500 transition-colors">
              <User className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">{t('dashboard')}</span>
            </Link>
            <div className="relative -mt-6">
              <Link
                to="/waste"
                className="w-14 h-14 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-glow hover:bg-primary-600 transition-transform hover:scale-110 border-4 border-[var(--bg-color)]"
              >
                <Plus className="w-6 h-6" />
              </Link>
            </div>
            <Link to="/wallet" className="flex flex-col items-center p-2 opacity-70 hover:opacity-100 hover:text-secondary-500 transition-colors">
              <CreditCard className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">{t('wallet')}</span>
            </Link>
            <Link to="/chat" className="flex flex-col items-center p-2 opacity-70 hover:opacity-100 hover:text-secondary-500 transition-colors relative">
              <MessageCircle className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">{t('chat')}</span>
              {unreadMsgs > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadMsgs}
                </span>
              )}
            </Link>
          </div>
        </nav>
      )}

      <Chatbot />
    </div>
  )
}

