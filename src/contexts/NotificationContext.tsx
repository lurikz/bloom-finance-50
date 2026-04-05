import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';

export type NotificationType = 'income' | 'expense' | 'reminder' | 'alert' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  read: boolean;
  createdAt: string; // ISO string
  source?: 'local' | 'server';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt' | 'source'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  refreshServerNotifications: () => void;
}

const LOCAL_KEY = 'fincontrol_notifications';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function loadLocal(): Notification[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(items: Notification[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items.filter(n => n.source !== 'server')));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [localNotifs, setLocalNotifs] = useState<Notification[]>(loadLocal);
  const [serverNotifs, setServerNotifs] = useState<Notification[]>([]);

  useEffect(() => { saveLocal(localNotifs); }, [localNotifs]);

  const fetchServer = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const data = await api.getMyNotifications();
      setServerNotifs(data.map((n: any) => ({
        id: n.id,
        type: n.type as NotificationType,
        title: n.title,
        description: n.message,
        read: n.read,
        createdAt: n.created_at,
        source: 'server' as const,
      })));
    } catch { /* ignore if not logged in */ }
  }, []);

  // Fetch on mount and periodically
  useEffect(() => {
    fetchServer();
    const interval = setInterval(fetchServer, 30000); // every 30s
    return () => clearInterval(interval);
  }, [fetchServer]);

  const notifications = [...serverNotifs, ...localNotifs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'read' | 'createdAt' | 'source'>) => {
    const newN: Notification = {
      ...n,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date().toISOString(),
      source: 'local',
    };
    setLocalNotifs(prev => [newN, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    // Try server
    api.markNotificationRead(id).catch(() => {});
    setServerNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    api.markAllNotificationsRead().catch(() => {});
    setServerNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setLocalNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setServerNotifs(prev => prev.filter(n => n.id !== id));
    setLocalNotifs(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setLocalNotifs([]);
    setServerNotifs([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, deleteNotification, clearAll, refreshServerNotifications: fetchServer }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
