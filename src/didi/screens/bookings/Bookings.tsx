import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronRight, Info, Sprout } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { SearchBox } from '@/d3/ui/SearchBox';
import { Chip, ChipRow } from '@/d3/ui/Controls';
import { TAP } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Note, SkelList, StatusTag } from '../../ui/Blocks';
import { useLoad } from '../../ui/Kit';
import { DateRangeGroup, FilterButton, FilterChip, FilterGroup, FilterSheet, SearchRow } from '../../ui/Filters';
import { useDidi } from '../../store';
import { BOOKINGS, BOOKING_LABEL, BOOKING_TONE, filterBookings, type BookingFilter, type BookingStatus, type DidiBooking } from '../../data/bookings';
import { farmerById } from '../../data/farmers';
import { to } from '../../paths';
import s from './Bookings.module.css';

const STATUSES: BookingStatus[] = ['pending', 'approved', 'rejected', 'cancel_requested', 'cancelled', 'completed'];
const NONE: BookingFilter = { status: 'all' };
const farmerName = (id: string) => farmerById(id)?.name ?? id;

export function BookingCard({ b }: { b: DidiBooking }) {
  const f = farmerById(b.farmerId);
  return (
    <motion.div whileTap={TAP}>
      <Link to={to(`/bookings/${b.id}`)} className={s.card}>
        <span className={s.cardTop}>
          <span className={s.ref}>Booking #{b.id}</span>
          <StatusTag tone={BOOKING_TONE[b.status]}>{BOOKING_LABEL[b.status]}</StatusTag>
        </span>
        <strong className={s.farmer}>{f?.name ?? b.farmerId}</strong>
        <span className={s.meta}>
          {b.farmerId} · {f?.village}
        </span>
        <span className={s.line}>
          <Sprout aria-hidden /> {b.landName} · {b.crop}, {b.acres} acres
        </span>
        <span className={s.foot}>
          <span>
            <CalendarDays aria-hidden /> Visit {formatDate(b.date, 'medium')}, {b.slot}
          </span>
          <span>Booked {formatDate(b.createdAt, 'short')}</span>
          <ChevronRight aria-hidden className={s.chev} />
        </span>
      </Link>
    </motion.div>
  );
}

export default function Bookings() {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<BookingFilter>(NONE);
  const [open, setOpen] = useState(false);
  const load = useLoad('bookings');
  const empty = useDidi((st) => st.demo.empty);
  const all = empty ? [] : BOOKINGS;
  const list = filterBookings(all, q, filters, farmerName);
  const n = (filters.status !== 'all' ? 1 : 0) + (filters.from || filters.to ? 1 : 0);
  const count = (st: BookingStatus) => all.filter((b) => b.status === st).length;
  const clear = () => (setQ(''), setFilters(NONE));

  return (
    <Screen title="Bookings" backTo="/home">
      <PageTitle kicker="Straw clearing" title="Bookings" deck="Baler bookings for farmers in your cluster. Decisions come from Kisani Urjaa." />
      <div className={s.page}>
        <div className={s.tools}>
          <SearchRow>
            <SearchBox value={q} onChange={setQ} placeholder="Search booking ID or farmer" label="Search bookings" />
            <FilterButton compact count={n} onClick={() => setOpen(true)} />
          </SearchRow>
          <ChipRow label="Booking status" className={s.chips}>
            <Chip selected={filters.status === 'all'} onClick={() => setFilters({ ...filters, status: 'all' })} count={all.length}>
              All
            </Chip>
            {STATUSES.filter((st) => count(st) > 0).map((st) => (
              <Chip key={st} selected={filters.status === st} onClick={() => setFilters({ ...filters, status: st })} count={count(st)}>
                {BOOKING_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
        </div>
        {load.status === 'loading' ? (
          <SkelList count={4} thumb={0} />
        ) : load.status === 'error' ? (
          <ErrorState error={load.error} onRetry={load.retry} />
        ) : all.length === 0 ? (
          <EmptyState animation="records" title="No bookings yet" body="Straw clearing bookings for your farmers will appear here." compact />
        ) : list.length === 0 ? (
          <EmptyState animation="search" title="No bookings found" body={q ? `Nothing matches “${q}”. Search by booking number, like 4619, or by farmer name.` : 'No bookings match these filters.'} action={<Button variant="secondary" onClick={clear}>Clear search and filters</Button>} compact />
        ) : (
          <>
            <p className={s.count} aria-live="polite">
              {list.length === all.length ? `All ${list.length} bookings` : `${list.length} of ${all.length} bookings`}
            </p>
            <motion.ul className={s.list} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
              <AnimatePresence initial={false}>
                {list.map((b) => (
                  <motion.li key={b.id} layout variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0, scale: 0.98 }}>
                    <BookingCard b={b} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          </>
        )}
        <div className={s.gutter}>
          <Note tone="info" icon={<Info aria-hidden />}>
            Approvals, rejections and cancellations are decided by Kisani Urjaa. You’ll get a notification for each update.
          </Note>
        </div>
      </div>

      <FilterSheet open={open} onClose={() => setOpen(false)} title="Filter bookings" value={filters} empty={NONE} onApply={setFilters} resultCount={(d) => filterBookings(all, q, d, farmerName).length}>
        {(d, set) => (
          <>
            <FilterGroup label="Status">
              <FilterChip on={d.status === 'all'} onClick={() => set({ ...d, status: 'all' })}>
                All
              </FilterChip>
              {STATUSES.map((st) => (
                <FilterChip key={st} on={d.status === st} onClick={() => set({ ...d, status: st })} count={count(st)}>
                  {BOOKING_LABEL[st]}
                </FilterChip>
              ))}
            </FilterGroup>
            <DateRangeGroup label="Visit date" value={{ from: d.from, to: d.to }} onChange={(r) => set({ ...d, from: r.from, to: r.to })} presets="both" />
          </>
        )}
      </FilterSheet>
    </Screen>
  );
}
