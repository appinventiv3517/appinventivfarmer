import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, Info, Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { Cascade, Rise } from '@/d3/motion/Reveal';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, Note } from '../../ui/Blocks';
import { useDidi } from '../../store';
import { STEPS, isComplete, nextStep, type Cycle } from '../../data/collection';
import { farmerById } from '../../data/farmers';
import { to } from '../../paths';
import { CycleProgress, StepGrid } from './parts';
import s from './Collection.module.css';

const lastUpdate = (c: Cycle) => Object.values(c.steps).map((x) => x!.updatedAt).sort().pop() ?? c.startedAt;

/** All form cycles for one farmer, newest first. One cycle can be in progress at a time. */
export default function Cycles() {
  const { id = '' } = useParams();
  const f = farmerById(id);
  const all = useDidi((st) => st.collection);
  if (!f)
    return (
      <Screen title="Data collection" backTo="/farmers">
        <EmptyState animation="search" title="Farmer not found" body={`No farmer with ID ${id} is registered in your cluster.`} action={<Button to="/farmers">See all farmers</Button>} />
      </Screen>
    );
  const cycles = all.filter((c) => c.farmerId === f.id).sort((a, b) => b.no - a.no);
  const open = cycles.find((c) => !isComplete(c));
  const base = `/farmers/${f.id}/collection`;
  const canStart = f.lands.length > 0;

  return (
    <Screen
      title="Data collection"
      backTo={`/farmers/${f.id}`}
      footer={
        open ? (
          <Note tone="warning" icon={<Info aria-hidden />}>
            Complete form cycle {open.no} before starting a new one.
          </Note>
        ) : (
          <Button size="lg" block icon={<Plus aria-hidden />} to={`${base}/new/land_prep/edit`} disabled={!canStart}>
            Start new collection
          </Button>
        )
      }
    >
      <PageTitle kicker={`${f.name} · ${f.id}`} title="Data collection" deck="Form cycles that follow one crop from land preparation to transport." />
      <div className={s.page}>
        {cycles.length === 0 ? (
          <EmptyState animation="records" title="No form cycles yet" body={canStart ? 'Start the first data collection to see it here.' : `Add ${f.name.split(' ')[0]}’s land first. A form cycle follows the crop on one plot.`} compact />
        ) : (
          <Cascade className={s.page} style={{ padding: 0 }}>
            {cycles.map((c) => {
              const done = isComplete(c);
              const nx = nextStep(c);
              const land = f.lands.find((l) => l.id === c.landId);
              return (
                <Rise key={c.id} className={`${s.cycle} ${done ? s.cycleDone : ''}`}>
                  <CycleProgress cycle={c} />
                  <p className={s.stepMeta}>
                    {land ? `${land.name} · ${land.crop ? `${land.crop.name}, ${land.crop.season}` : 'crop not recorded'}` : 'Land removed'}
                  </p>
                  <StepGrid cycle={c} />
                  {done ? (
                    <div className={s.cycleFoot}>
                      <span>Last updated {formatDate(lastUpdate(c), 'medium')}</span>
                      <Link to={to(`${base}/${c.id}`)}>
                        View details <ChevronRight aria-hidden />
                      </Link>
                    </div>
                  ) : (
                    <div className={s.stepActions}>
                      <Button variant="secondary" to={`${base}/${c.id}`}>
                        Details
                      </Button>
                      <Button block iconRight={<ArrowRight aria-hidden />} to={`${base}/${c.id}/${nx}/edit`}>
                        Continue
                      </Button>
                    </div>
                  )}
                </Rise>
              );
            })}
          </Cascade>
        )}
        <p className={s.nothing}>
          {STEPS.length} steps per cycle: {STEPS.map((x) => x.title).join(', ')}.
        </p>
      </div>
    </Screen>
  );
}
