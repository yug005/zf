import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CircleCheck,
  Clock3,
  CreditCard,
} from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notifications';

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notificationUnreadCount'],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: isOpen,
    staleTime: 30_000,
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markOneReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  const notificationTone = (type: string) => {
    if (type === 'TRIAL_EXPIRING' || type === 'MONITOR_LIMIT_REACHED') {
      return 'border-l-amber-400 bg-amber-50 dark:bg-amber-900/20';
    }
    if (type === 'TRIAL_EXPIRED') {
      return 'border-l-red-400 bg-red-50 dark:bg-red-900/20';
    }
    if (type === 'SUBSCRIPTION_ACTIVATED') {
      return 'border-l-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
    }
    if (type === 'SUBSCRIPTION_CANCELLED') {
      return 'border-l-orange-400 bg-orange-50 dark:bg-orange-900/20';
    }
    if (type === 'PAYMENT_FAILED' || type === 'PAYMENT_FAILED_FINAL') {
      return 'border-l-rose-400 bg-rose-50 dark:bg-rose-900/20';
    }
    return 'border-l-slate-300 dark:border-l-slate-600 bg-white dark:bg-white/5';
  };

  const notificationIcon = (type: string) => {
    if (type === 'TRIAL_EXPIRING') return <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    if (type === 'TRIAL_EXPIRED') return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    if (type === 'MONITOR_LIMIT_REACHED') return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    if (type === 'SUBSCRIPTION_ACTIVATED') return <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    if (type === 'SUBSCRIPTION_CANCELLED') return <CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    if (type === 'PAYMENT_FAILED' || type === 'PAYMENT_FAILED_FINAL') {
      return <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    }
    return <Bell className="h-4 w-4 text-[var(--color-text-tertiary)]" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="relative rounded-full p-2 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] hover:bg-slate-100 dark:hover:bg-white/10"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border shadow-xl"
          style={{
            borderColor: 'var(--color-border-primary)',
            background: 'var(--color-surface-elevated)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--color-border-secondary)' }}
          >
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 ? (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="flex items-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">No notifications yet</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 border-b px-4 py-3 last:border-0 border-l-4 ${notificationTone(notification.type)} ${!notification.read ? 'font-medium' : ''}`}
                  style={{ borderBottomColor: 'var(--color-border-secondary)' }}
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 dark:bg-white/10">
                    {notificationIcon(notification.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">{notification.title}</p>
                      {!notification.read ? (
                        <button
                          onClick={() => markOneReadMutation.mutate(notification.id)}
                          className="shrink-0 rounded-full p-1 text-[var(--color-text-tertiary)] hover:bg-slate-200 dark:hover:bg-white/10"
                          aria-label="Mark as read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-secondary)]">{notification.message}</p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">{formatTime(notification.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
