import { useTranslation } from 'react-i18next';
import { useEffect, useState, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { http } from '../../api/http';
import type { RootState } from '../../store/types';

export const NotificationBell = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const user = useSelector((s: RootState) => s.auth.user);
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead && n.type !== 'message_received').length;

  useEffect(() => {
    let alive = true;
    const fetchNotifs = async () => {
      if (!user || !accessToken) return;
      try {
        const res = await http.get('/api/notifications', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (alive) {
          // Filter out chat messages from the main notification dropdown
          setNotifications(res.data.notifications.filter((n: any) => n.type !== 'message_received'));
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifs();

    // Setup Socket connection for real-time updates
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    const socket: Socket = io(baseURL, { auth: { token: accessToken } });

    socket.on('new_notification', (n: any) => {
      if (!alive) return;
      if (n.type !== 'message_received') {
        setNotifications((prev) => [n, ...prev]);
      }
    });

    socket.on('transaction_update', () => {
      if (!alive) return;
      fetchNotifs(); // Refresh list to get latest state
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
      console.error('Failed to mark as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        notifications.filter(n => !n.isRead).map(n => 
          http.post(`/api/notifications/${n._id}/read`, {}, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
        )
      );
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleNotificationClick = (n: any) => {
    markAsRead(n._id);
    setIsOpen(false);
    
    // Basic contextual routing based on type
    if (n.type === 'QR_SENT' || n.type === 'transactions') navigate('/wallet');
    else if (n.type === 'INTEREST_SELECTED') navigate('/notifications');
    else if (n.type === 'interest_received' || n.type === 'barter_request') navigate('/dashboard');
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-[var(--text-primary)] transition-colors relative shadow-glass border border-black/5 dark:border-white/10"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-primary-600 shadow-sm animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto rounded-2xl border border-black/5 dark:border-white/20 dark:border-black/5 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-2xl z-50 overflow-hidden flex flex-col">
          <div className="sticky top-0 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-gray-100 dark:border-black/5 dark:border-white/10 p-3 flex justify-between items-center z-10 shrink-0 shadow-sm">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{t('auto.notifications', `Notifications`)}</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead} 
                className="text-xs px-2 py-1 rounded-md bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 text-primary-600 dark:text-primary-400 font-medium flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" /> {t('auto.mark_all_read', `Mark all read`)}
                                            </button>
            )}
          </div>
          
          <div className="flex flex-col flex-grow relative z-0">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm italic w-full">{t('auto.no_notifications_yet_you_re_al', `No notifications yet. You're all caught up!`)}</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-4 border-b border-gray-50 dark:border-white/5 cursor-pointer transition-all active:scale-[0.98] ${
                    !n.isRead 
                      ? 'bg-emerald-50/60 dark:bg-emerald-900/10 hover:bg-primary-100/60 dark:hover:bg-primary-900/20' 
                      : 'hover:bg-gray-50/80 dark:hover:glass opacity-30'
                  }`}
                >
                  <p className={`text-sm tracking-tight leading-tight ${!n.isRead ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-600 dark:text-gray-300'}`}>
                    {n.message || 'New ecosystem update received!'}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-2 block font-medium">
                    {new Date(n.createdAt).toLocaleDateString()} {t('auto.at', `at`)} {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
