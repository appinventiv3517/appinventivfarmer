import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Phone } from 'lucide-react';
import { formatPhone, initials } from '@/lib/format';
import { SearchBox } from '@/d3/ui/SearchBox';
import { TAP } from '@/d3/motion/tokens';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, SkelList, StatusTag } from '../../ui/Blocks';
import { Ring, useLoad } from '../../ui/Kit';
import { DateRangeGroup, FilterButton, FilterChip, FilterGroup, FilterSheet, SearchRow } from '../../ui/Filters';
import { useDidi, useFarmerVerification } from '../../store';
import { FARMERS, FARMER_FILTERS, NO_FARMER_FILTERS, VERIFY_LABEL, VERIFY_TONE, activeFarmerFilters, completion, filterFarmers, type Farmer, type FarmerFilters, type VerifyStatus } from '../../data/farmers';
import { to } from '../../paths';
import s from './Farmers.module.css';

const VERIFY_OPTIONS: VerifyStatus[] = ['verified', 'unverified', 'pending', 'failed'];

export function FarmerCard({ f }: { f: Farmer }) {
  const pct = completion(f);
  const v = useFarmerVerification(f)!;
  const ok = v.status === 'verified';
  return (
    <motion.div whileTap={TAP} layout="position">
      <Link to={to(`/farmers/${f.id}`)} className={`${s.card} ${ok ? '' : s.cardUnverified}`} aria-label={`${f.name}, ${VERIFY_LABEL[v.status]}, profile ${pct}% complete`}>
        <span className={s.avatar} aria-hidden>
          {initials(f.name)}
          {ok && (
            <span className={s.avatarBadge}>
              <BadgeCheck />
            </span>
          )}
        </span>
        <span className={s.text}>
          <strong className={s.name}>{f.name}</strong>
          <span className={s.meta}>
            <span className={s.id}>{f.id}</span> · {f.village}
          </span>
          <span className={s.meta}>
            <Phone aria-hidden /> {formatPhone(f.phone)}
          </span>
          <span className={s.verifyRow}>
            <StatusTag tone={VERIFY_TONE[v.status]}>{VERIFY_LABEL[v.status]}</StatusTag>
          </span>
        </span>
        <Ring value={pct} size={50} stroke={5} label={`Profile ${pct}% complete`} tone={pct === 100 ? 'green' : 'clay'} />
      </Link>
    </motion.div>
  );
}

export default function Farmers() {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<FarmerFilters>(NO_FARMER_FILTERS);
  const [open, setOpen] = useState(false);
  const load = useLoad('farmers');
  const empty = useDidi((st) => st.demo.empty);
  const overrides = useDidi((st) => st.farmerVerify);
  const all = empty ? [] : FARMERS;
  const verifyOf = (f: Farmer) => overrides[f.id]?.status ?? f.verification.status;
  const villages = useMemo(() => [...new Set(FARMERS.map((f) => f.village))].sort(), []);
  const list = filterFarmers(all, q, filters, 'all', verifyOf);
  const n = activeFarmerFilters(filters);
  const verifiedCount = all.filter((f) => verifyOf(f) === 'verified').length;
  const clear = () => (setQ(''), setFilters(NO_FARMER_FILTERS));

  return (
    <Screen title="Farmers" variant="masthead" tabRoot kicker={`${all.length} farmers · ${verifiedCount} verified`} deck="Everyone registered in your cluster.">
      <div className={s.page}>
        <div className={s.tools}>
          <SearchRow>
            <SearchBox value={q} onChange={setQ} placeholder="Search name, ID or phone" label="Search farmers" />
            <FilterButton compact count={n} onClick={() => setOpen(true)} />
          </SearchRow>
        </div>
        {load.status === 'loading' ? (
          <SkelList count={5} thumb={52} />
        ) : load.status === 'error' ? (
          <ErrorState error={load.error} onRetry={load.retry} />
        ) : all.length === 0 ? (
          <EmptyState animation="records" title="No farmers yet" body="Farmers you register in your cluster will appear here." compact />
        ) : list.length === 0 ? (
          <EmptyState animation="search" title="No farmers found" body={q ? `Nothing matches “${q}”. Check the spelling, or search by farmer ID or phone.` : 'No farmers match these filters.'} action={<Button variant="secondary" onClick={clear}>Clear search and filters</Button>} compact />
        ) : (
          <>
            <p className={s.count} aria-live="polite">
              {list.length === all.length ? `All ${list.length} farmers` : `${list.length} of ${all.length} farmers`}
            </p>
            <motion.ul className={s.list} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
              <AnimatePresence initial={false}>
                {list.map((f) => (
                  <motion.li key={f.id} layout variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0, scale: 0.98 }}>
                    <FarmerCard f={f} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          </>
        )}
      </div>

      <FilterSheet open={open} onClose={() => setOpen(false)} title="Filter farmers" value={filters} empty={NO_FARMER_FILTERS} onApply={setFilters} resultCount={(d) => filterFarmers(all, q, d, 'all', verifyOf).length}>
        {(d, set) => (
          <>
            <FilterGroup label="Verification">
              <FilterChip on={d.verify === 'all'} onClick={() => set({ ...d, verify: 'all' })}>
                All
              </FilterChip>
              {VERIFY_OPTIONS.map((v) => (
                <FilterChip key={v} on={d.verify === v} onClick={() => set({ ...d, verify: v })} count={all.filter((f) => verifyOf(f) === v).length}>
                  {VERIFY_LABEL[v]}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup label="Profile">
              {FARMER_FILTERS.map((x) => (
                <FilterChip key={x.value} on={d.profile === x.value} onClick={() => set({ ...d, profile: x.value })}>
                  {x.label}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup label="Village">
              <FilterChip on={d.village === 'all'} onClick={() => set({ ...d, village: 'all' })}>
                All villages
              </FilterChip>
              {villages.map((v) => (
                <FilterChip key={v} on={d.village === v} onClick={() => set({ ...d, village: v })}>
                  {v}
                </FilterChip>
              ))}
            </FilterGroup>
            <DateRangeGroup label="Registered" value={{ from: d.from, to: d.to }} onChange={(r) => set({ ...d, from: r.from, to: r.to })} />
          </>
        )}
      </FilterSheet>
    </Screen>
  );
}
