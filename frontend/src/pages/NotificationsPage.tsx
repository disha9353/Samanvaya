import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ShoppingBag, Leaf, Wallet, Check, AlertCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { http } from '../api/http';
import type { RootState } from '../store/types';

export default function NotificationsPage() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'marketplace' | 'transactions' | 'environmental'>('marketplace');

  useEffect(() => {
    let alive = true;
    async function fetchNotifs() {
      if (!user || !accessToken) return;
      try {
        setLoading(true);
        const res = await http.get('/api/notifications', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (alive) {
          const filtered = res.data.notifications.filter((n: any) => n.type !== 'message_received');
          setNotifications(filtered);
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchNotifs();

    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    const socket: Socket = io(baseURL, { auth: { token: accessToken } });

    socket.on('new_notification', (n: any) => {
      if (!alive) return;
      if (n.type !== 'message_received') {
        setNotifications((prev) => [n, ...prev]);
      }
    });

    socket.on('transaction_update', () => {
      if (alive) fetchNotifs();
    });

    return () => {
      alive = false;
      socket.disconnect();
    };
  }, [user, accessToken]);

  const markAsRead = async (id: string) => {
    try {
      await http.post(`/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const categorize = (n: any) => {
    const type = n.type || '';
    if (['interest_received', 'INTEREST_SELECTED', 'barter_request'].includes(type)) return 'marketplace';
    if (['payment_completed', 'QR_SENT', 'TRANSACTION_UPDATE'].includes(type)) return 'transactions';
    return 'environmental';
  };

  const filteredNotifs = notifications.filter(n => categorize(n) === activeTab);
  const pendingCount = {
    marketplace:   notifications.filter(n => categorize(n) === 'marketplace'   && !n.isRead).length,
    transactions:  notifications.filter(n => categorize(n) === 'transactions'  && !n.isRead).length,
    environmental: notifications.filter(n => categorize(n) === 'environmental' && !n.isRead).length,
  };

  const tabs = [
    { id: 'marketplace',  label: t('auto.marketplace', 'Marketplace'),  icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'transactions', label: t('auto.transactions', 'Transactions'),  icon: <Wallet      className="w-4 h-4" /> },
    { id: 'environmental',label: t('auto.environmental', 'Environmental'), icon: <Leaf        className="w-4 h-4" /> },
  ];

  const iconBg: Record<string, string> = {
    marketplace:  'bg-blue-100/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    transactions: 'bg-purple-100/80 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    environmental:'bg-secondary-500/10 text-secondary-500 dark:bg-secondary-500/20 dark:text-secondary-50',
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center text-[var(--text-primary)]">
      <div className="w-full max-w-4xl mt-2">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center shadow-sm">
            <Bell className="w-6 h-6 text-primary-500" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--text-primary)]">{t('auto.notifications', `Notifications`)}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('auto.manage_all_your_platform_activ', `Manage all your platform activity and alerts`)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 glass p-2 rounded-2xl shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-glow'
                  : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {(pendingCount as any)[tab.id] > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-accent text-white'
                }`}>
                  {(pendingCount as any)[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="glass-card p-4 sm:p-6 min-h-[400px]">
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-2xl glass animate-pulse w-full"></div>
              ))}
            </div>
          ) : filteredNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="w-20 h-20 mb-5 rounded-full glass flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-[var(--text-secondary)]" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">{t('auto.no_events_found', `No events found`)}</h3>
              <p className="text-[var(--text-secondary)] mt-2 text-sm">{t('auto.you_don_t_have_any', `You don't have any`)} {activeTab} {t('auto.notifications_yet', `notifications yet.`)}</p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="flex flex-col gap-3">
                {filteredNotifs.map((n: any, i: number) => (
                  <motion.div
                    layout
                    key={n._id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className={`notification-item p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 border ${
                      !n.isRead
                        ? 'glass-card notification-unread border-primary-500/20'
                        : 'glass border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-4 flex-1 w-full">
                      <div className={`p-3 rounded-xl shrink-0 shadow-sm ${iconBg[activeTab]}`}>
                        {activeTab === 'marketplace'   && <ShoppingBag className="w-5 h-5" />}
                        {activeTab === 'transactions'  && <Wallet      className="w-5 h-5" />}
                        {activeTab === 'environmental' && <Leaf        className="w-5 h-5" />}
                      </div>
                      <div>
                        {!n.isRead && (
                          <span className="inline-block mb-1 text-[10px] font-bold uppercase tracking-widest text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-full">{t('auto.new', `New`)}</span>
                        )}
                        <p className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>
                          {n.message}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] opacity-60 mt-1 uppercase tracking-wider">
                          {new Date(n.createdAt).toLocaleDateString()} · {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {!n.isRead && (
                      <button
                        onClick={() => markAsRead(n._id)}
                        className="btn-ripple w-full sm:w-auto px-4 py-2 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-500 font-bold text-sm flex items-center justify-center gap-2 transition-all shrink-0 border border-primary-500/20 hover:scale-105"
                      >
                        <Check className="w-4 h-4" /> {t('auto.mark_read', `Mark Read`)}
                                                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
