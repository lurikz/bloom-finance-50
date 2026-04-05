import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, ArrowDownCircle, ArrowUpCircle, Clock, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, NotificationType } from '@/contexts/NotificationContext';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const typeIcon: Record<NotificationType, typeof Bell> = {
  income: ArrowDownCircle,
  expense: ArrowUpCircle,
  reminder: Clock,
  alert: AlertTriangle,
  system: Info,
};

const typeColor: Record<NotificationType, string> = {
  income: 'text-[hsl(var(--income))]',
  expense: 'text-[hsl(var(--expense))]',
  reminder: 'text-[hsl(var(--chart-2))]',
  alert: 'text-[hsl(var(--chart-4))]',
  system: 'text-muted-foreground',
};

function groupByDate(notifications: { createdAt: string }[]) {
  const groups: Record<string, typeof notifications> = {};
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    let label: string;
    if (isToday(d)) label = 'Hoje';
    else if (isYesterday(d)) label = 'Ontem';
    else label = format(d, "dd 'de' MMMM", { locale: ptBR });
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelWidth = isMobile ? window.innerWidth : 384; // sm:w-96
    let left = rect.left;
    // If panel would overflow right edge, align to right edge
    if (left + panelWidth > window.innerWidth - 8) {
      left = window.innerWidth - panelWidth - 8;
    }
    // If panel would overflow left edge
    if (left < 8) left = 8;
    setPos({ top: rect.bottom + 8, left, right: window.innerWidth - rect.right });
  }, [isMobile]);

  useEffect(() => {
    if (!open) return;
    calcPos();
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const resizeHandler = () => calcPos();
    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', resizeHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', resizeHandler);
    };
  }, [open, calcPos]);

  const groups = groupByDate(notifications);

  return (
    <>
      <Button ref={btnRef} variant="ghost" size="icon" className="relative" onClick={() => setOpen(!open)} aria-label="Notificações">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Backdrop mobile */}
      {open && isMobile && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
      )}

      {open && pos && (
        <div
          ref={panelRef}
          style={isMobile
            ? { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }
            : { position: 'fixed', top: pos.top, left: pos.left, zIndex: 50 }
          }
          className={`flex flex-col border border-border bg-card shadow-xl transition-all duration-200 animate-in fade-in ${
            isMobile
              ? 'w-full max-h-[80vh] rounded-t-2xl slide-in-from-bottom-4'
              : 'w-96 max-h-[70vh] rounded-xl slide-in-from-top-2'
          }`}
        >
          {/* Drag handle mobile */}
          {isMobile && (
            <div className="flex justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={markAllAsRead}>
                  <CheckCheck className="h-3.5 w-3.5" /> Ler todas
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Nenhuma notificação no momento</p>
              </div>
            ) : (
              Object.entries(groups).map(([label, items]) => (
                <div key={label}>
                  <div className="sticky top-0 bg-card/95 backdrop-blur px-4 py-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
                  </div>
                  {items.map((n: any) => {
                    const Icon = typeIcon[n.type as NotificationType] || Bell;
                    const color = typeColor[n.type as NotificationType] || 'text-muted-foreground';
                    return (
                      <div
                        key={n.id}
                        className={`group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-accent/50 ${!n.read ? 'bg-accent/30' : ''}`}
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className={`mt-0.5 shrink-0 ${color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm truncate ${!n.read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>{n.title}</p>
                            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">{format(new Date(n.createdAt), 'HH:mm')}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
