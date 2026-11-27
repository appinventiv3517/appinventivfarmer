import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone } from 'lucide-react';
import { formatPhone, initials } from '@/lib/format';
import { SearchBox } from '@/d3/ui/SearchBox';
import { Chip, ChipRow } from '@/d3/ui/Controls';
import { TAP } from '@/d3/motion/tokens';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, SkelList } from '../../ui/Blocks';
import { Ring, useLoad } from '../../ui/Kit';
import { FARMERS, FARMER_FILTERS, completion, filterFarmers, type Farmer, type FarmerFilter } from '../../data/farmers';
import { to } from '../../paths';
import s from './Farmers.module.css';

export function FarmerCard({ f }: { f: Farmer }) {
  const pct = completion(f);
  return (
    <motion.div whileTap={TAP} layout="position">
      <Link to={to(`/farmers/${f.id}`)} className={s.card}>
        <span className={s.avatar} aria-hidden>
          {initials(f.name)}
        </span>
        <span className={s.text}>
          <strong className={s.name}>{f.name}</strong>
          <span className={s.meta}>
            <span className={s.id}>{f.id}</span> · {f.village}
          </span>
          <span className={s.meta}>
            <Phone aria-hidden /> {formatPhone(f.phone)}
          </span>
        </span>
        <Ring value={pct} size={50} stroke={5} label={`Profile ${pct}% complete`} tone={pct === 100 ? 'green' : 'clay'} />
      </Link>
    </motion.div>
  );
}

export default function Farmers() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FarmerFilter>('all');
  const [village, setVillage] = useState('all');
  const load = useLoad('farmers');
  const villages = useMemo(() => [...new Set(FARMERS.map((f) => f.village))].sort(), []);
  const list = filterFarmers(FARMERS, q, filter, village);
  const counts = Object.fromEntries(FARMER_FILTERS.map((x) => [x.value, filterFarmers(FARMERS, '', x.value, village).length]));
  const clear = () => (setQ(''), setFilter('all'), setVillage('all'));
  return (
    <Screen title="Farmers" variant="masthead" tabRoot kicker={`${FARMERS.length} farmers · ${villages.length} villages`} deck="Everyone registered in your cluster.">
      <div className={s.page}>
        <div className={s.tools}>
          <SearchBox value={q} onChange={setQ} placeholder="Search name, farmer ID or phone" label="Search farmers" />
          <ChipRow label="Profile status" className={s.chips}>
            {FARMER_FILTERS.map((x) => (
              <Chip key={x.value} selected={filter === x.value} onClick={() => setFilter(x.value)} count={counts[x.value]}>
                {x.label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Village" className={s.chips}>
            <Chip selected={village === 'all'} onClick={() => setVillage('all')}>
              All villages
            </Chip>
            {villages.map((v) => (
              <Chip key={v} selected={village === v} onClick={() => setVillage(v)}>
                {v}
              </Chip>
            ))}
          </ChipRow>
        </div>
        {load.status === 'loading' ? (
          <SkelList count={5} thumb={52} />
        ) : load.status === 'error' ? (
          <ErrorState error={load.error} onRetry={load.retry} />
        ) : list.length === 0 ? (
          <EmptyState animation="search" title="No farmers found" body={q ? `Nothing matches “${q}”. Check the spelling, or search by farmer ID.` : 'No farmers match these filters.'} action={<Button variant="secondary" onClick={clear}>Clear search and filters</Button>} compact />
        ) : (
          <>
            <p className={s.count} aria-live="polite">
              {list.length === FARMERS.length ? `All ${list.length} farmers` : `${list.length} of ${FARMERS.length} farmers`}
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
    </Screen>
  );
}
