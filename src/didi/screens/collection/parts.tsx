import { Check } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { StatusTag } from '../../ui/Blocks';
import { Bar } from '../../ui/Kit';
import { useDidi } from '../../store';
import { STEPS, isComplete, nextStep, submittedCount, type Ctx, type Cycle } from '../../data/collection';
import { farmerById, type Farmer, type FarmerLand } from '../../data/farmers';
import s from './Collection.module.css';

/** The farmer, the cycle and its land, from the route. */
export function useCycle(farmerId: string, cycleId: string) {
  const f = farmerById(farmerId);
  const cycle = useDidi((st) => st.collection.find((c) => c.id === cycleId && c.farmerId === f?.id));
  const land = f?.lands.find((l) => l.id === cycle?.landId);
  return { f, cycle, land };
}

export const ctxOf = (land?: FarmerLand): Ctx => ({ sown: land?.crop?.sown });

export function cycleStatus(c: Cycle) {
  return isComplete(c) ? { label: 'Completed', tone: 'success' as const } : { label: 'In progress', tone: 'warning' as const };
}

/** Eight numbered tiles: done, current (next to fill) or pending. */
export function StepGrid({ cycle }: { cycle: Cycle }) {
  const next = nextStep(cycle);
  return (
    <ol className={s.grid} aria-label="Form steps">
      {STEPS.map((st, i) => {
        const done = !!cycle.steps[st.key];
        const cur = st.key === next;
        return (
          <li key={st.key} className={`${s.tile} ${done ? s.tileDone : cur ? s.tileCur : ''}`}>
            <span className={s.tileNo}>{done ? <Check aria-hidden /> : i + 1}</span>
            <span className={s.tileName} title={st.title}>{st.short}</span>
            <span className="sr-only">{done ? 'submitted' : cur ? 'next' : 'pending'}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function CycleProgress({ cycle }: { cycle: Cycle }) {
  const n = submittedCount(cycle);
  const pct = Math.round((n / STEPS.length) * 100);
  const st = cycleStatus(cycle);
  return (
    <div className={s.progress}>
      <div className={s.progressTop}>
        <strong>Form cycle {cycle.no}</strong>
        <StatusTag tone={st.tone}>{st.label}</StatusTag>
      </div>
      <div className={s.progressBar}>
        <Bar value={pct} label={`${n} of ${STEPS.length} forms submitted`} tone={pct === 100 ? 'green' : 'clay'} />
        <span className="didi-num">
          {n}/{STEPS.length}
        </span>
      </div>
    </div>
  );
}

/** Land and crop for the cycle, as in the design's Land details and Crops cards. */
export function LandCropCard({ f, land, compact }: { f: Farmer; land?: FarmerLand; compact?: boolean }) {
  if (!land) return null;
  return (
    <div className={s.landCard}>
      <div className={s.landHead}>
        <span>
          <small>Land</small>
          <strong>
            {land.name} · {land.areaAcres} acres
          </strong>
        </span>
        <StatusTag tone={land.ownership === 'Owned' ? 'success' : 'info'}>{land.ownership}</StatusTag>
      </div>
      {!compact && (
        <dl className={s.place}>
          <div>
            <dt>State</dt>
            <dd>{f.state}</dd>
          </div>
          <div>
            <dt>District</dt>
            <dd>{f.district}</dd>
          </div>
          <div>
            <dt>Mandal</dt>
            <dd>{f.mandal}</dd>
          </div>
          <div>
            <dt>Village</dt>
            <dd>{f.village}</dd>
          </div>
          <div>
            <dt>Pincode</dt>
            <dd>{f.pincode}</dd>
          </div>
          <div>
            <dt>Survey no.</dt>
            <dd>{land.surveyNo}</dd>
          </div>
        </dl>
      )}
      <div className={s.cropRow}>
        <span>
          <small>Crop</small>
          <strong>{land.crop ? `${land.crop.name} · ${land.crop.season}` : 'Not recorded'}</strong>
        </span>
        <span>
          <small>Sowing date</small>
          <strong>{land.crop ? formatDate(land.crop.sown, 'medium') : '—'}</strong>
        </span>
        <span>
          <small>Area under cultivation</small>
          <strong>{land.areaAcres} acres</strong>
        </span>
      </div>
    </div>
  );
}
