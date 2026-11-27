import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarClock, CheckCheck, ClipboardCheck, ClipboardPlus, Megaphone, UserRoundPlus, Wallet, CalendarCheck, Circle, CircleDot, Tractor } from 'lucide-react';
import { formatRelative } from '@/lib/format';
import { Chip, ChipRow } from '@/d3/ui/Controls';
import { useToast } from '@/d3/ui/Toast';
import { Screen, PageTitle } from '../../layout/Screen';
import { EmptyState } from '../../ui/Blocks';
import { didi, useDidi } from '../../store';
import { NOTIFICATIONS, NOTE_CATEGORY, type NoteCategory } from '../../data/notifications';
import { dayDiff } from '../../data/dates';
import { useNav } from '../../nav';
import s from './Notifications.module.css';

const ICON: Record<NoteCategory, typeof Bell> = { task: ClipboardPlus, deadline: CalendarClock, review: ClipboardCheck, farmer: UserRoundPlus, booking: Tractor, attendance: CalendarCheck, payment: Wallet, announcement: Megaphone };
type Filter = 'all' | 'unread' | 'tasks' | 'bookings' | 'farmers' | 'payments' | 'other';
const GROUP: Record<Filter, NoteCategory[] | null> = { all: null, unread: null, tasks: ['task', 'deadline', 'review'], bookings: ['booking'], farmers: ['farmer'], payments: ['payment'], other: ['attendance', 'announcement'] };

export default function Notifications() {
  const nav = useNav();
  const toast = useToast();
  const unread = useDidi((st) => st.unread);
  const [filter, setFilter] = useState<Filter>('all');
  const list = NOTIFICATIONS.filter((n) => (filter === 'unread' ? unread.includes(n.id) : !GROUP[filter] || GROUP[filter]!.includes(n.category)));
  const today = list.filter((n) => dayDiff(n.at) === 0);
  const earlier = list.filter((n) => dayDiff(n.at) !== 0);

  const open = (id: string, link?: string) => {
    didi.markRead(id);
    if (link) nav(link);
  };

  const group = (title: string, items: typeof list) =>
    items.length > 0 && (
      <section className={s.group} aria-label={title}>
        <h2 className={s.groupTitle}>{title}</h2>
        <ul className={s.list}>
          <AnimatePresence initial={false}>
            {items.map((n) => {
              const Icon = ICON[n.category];
              const isNew = unread.includes(n.id);
              return (
                <motion.li key={n.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className={`${s.item} ${isNew ? s.unread : ''}`}>
                  <button type="button" className={s.main} onClick={() => open(n.id, n.link)}>
                    <span className={`${s.icon} ${s[`c_${n.category}`]}`}>
                      <Icon aria-hidden />
                    </span>
                    <span className={s.text}>
                      <span className={s.meta}>
                        {NOTE_CATEGORY[n.category]} · {formatRelative(n.at)}
                      </span>
                      <strong>{n.title}</strong>
                      <span className={s.body}>{n.body}</span>
                    </span>
                  </button>
                  <button type="button" className={s.toggle} onClick={() => (isNew ? didi.markRead(n.id) : didi.markUnread(n.id))} aria-label={isNew ? 'Mark as read' : 'Mark as unread'}>
                    {isNew ? <CircleDot aria-hidden /> : <Circle aria-hidden />}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </section>
    );

  return (
    <Screen
      title="Notifications"
      backTo="/home"
      actions={
        unread.length > 0 && (
          <button type="button" className={s.markAll} onClick={() => (didi.markAllRead(), toast({ message: 'All marked as read', tone: 'success' }))}>
            <CheckCheck aria-hidden /> Mark all read
          </button>
        )
      }
    >
      <PageTitle kicker={unread.length ? `${unread.length} unread` : 'All caught up'} title="Notifications" />
      <ChipRow label="Show" className={s.chips}>
        {(['all', 'unread', 'tasks', 'bookings', 'farmers', 'payments', 'other'] as Filter[]).map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)} count={f === 'unread' ? unread.length : undefined}>
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : f === 'tasks' ? 'Tasks' : f === 'bookings' ? 'Bookings' : f === 'farmers' ? 'Farmers' : f === 'payments' ? 'Payments' : 'Other'}
          </Chip>
        ))}
      </ChipRow>
      <div className={s.page}>
        {list.length === 0 ? (
          <EmptyState animation="bell" title={filter === 'unread' ? 'No unread notifications' : 'Nothing here'} body="New updates from Kisani Urjaa will appear here." compact />
        ) : (
          <>
            {group('Today', today)}
            {group('Earlier', earlier)}
          </>
        )}
      </div>
    </Screen>
  );
}
