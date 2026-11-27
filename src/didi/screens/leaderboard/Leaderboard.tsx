import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Info } from 'lucide-react';
import { initials } from '@/lib/format';
import { SectionTabs, Toggle } from '@/d3/ui/Controls';
import { SPRING_SOFT, SWAP } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { ErrorState, Note, Skel } from '../../ui/Blocks';
import { useLoad } from '../../ui/Kit';
import { board, type Period, type Scope } from '../../data/leaderboard';
import s from './Leaderboard.module.css';

export default function Leaderboard() {
  const [scope, setScope] = useState<Scope>('state');
  const [period, setPeriod] = useState<Period>('month');
  const load = useLoad('leaderboard');
  const { list, me } = board(scope, period);
  const top = list.slice(0, 3);
  const rest = list.slice(3);
  const meListed = list.some((l) => l.me);
  const where = (l: { district: string; state: string }) => (scope === 'state' ? l.district : `${l.district}, ${l.state}`);
  return (
    <Screen title="Leaderboard" backTo="/home">
      <PageTitle kicker="Kisani Didis" title="Leaderboard" />
      <div className={s.page}>
        <div className={s.controls}>
          <SectionTabs label="Leaderboard scope" size="md" value={scope} onChange={setScope} items={[{ value: 'state', label: 'Maharashtra' }, { value: 'national', label: 'National' }]} />
          <Toggle label="Period" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'This month' }, { value: 'all', label: 'All time' }]} />
        </div>

        <motion.div className={s.mine} layout>
          <span className={s.mineRank}>#{me.rank}</span>
          <span className={s.mineText}>
            <strong>Your rank</strong>
            <small>
              of {me.of.toLocaleString('en-IN')} Kisani Didis {scope === 'state' ? 'in Maharashtra' : 'in India'}
            </small>
          </span>
          <span className={s.mineScore}>
            <strong>{me.score.toLocaleString('en-IN')}</strong>
            <small>points</small>
          </span>
        </motion.div>

        {load.status === 'loading' ? (
          <div className={s.gutter}>
            <Skel h={210} r="var(--r-xl)" />
            <Skel h={260} r="var(--r-xl)" style={{ marginTop: 12 }} />
          </div>
        ) : load.status === 'error' ? (
          <ErrorState error={load.error} onRetry={load.retry} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${scope}-${period}`} {...SWAP} className={s.body}>
              <ol className={s.podium} aria-label="Top three">
                {[top[1], top[0], top[2]].map((l, i) =>
                  l ? (
                    <motion.li key={l.id} className={`${s.place} ${s[`p${l.rank}`]} ${l.me ? s.isMe : ''}`} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.08 * i }}>
                      {l.rank === 1 && <Crown className={s.crown} aria-hidden />}
                      <span className={s.pAvatar}>{initials(l.name)}</span>
                      <strong className={s.pName}>{l.me ? 'You' : l.name.split(' ')[0]}</strong>
                      <small className={s.pWhere}>{scope === 'state' ? l.district : l.state}</small>
                      <span className={s.pBlock}>
                        <span className={s.pRank}>{l.rank}</span>
                        <span className={s.pScore}>{l.score.toLocaleString('en-IN')}</span>
                      </span>
                    </motion.li>
                  ) : null,
                )}
              </ol>
              <ol className={s.list} start={4}>
                {rest.map((l, i) => (
                  <motion.li key={l.id} className={`${s.row} ${l.me ? s.rowMe : ''}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.03 }}>
                    <span className={s.rank}>{l.rank}</span>
                    <span className={s.avatar}>{initials(l.name)}</span>
                    <span className={s.text}>
                      <strong>{l.me ? `${l.name} (you)` : l.name}</strong>
                      <small>
                        {where(l)} · {l.tasks} tasks · {l.farmers} farmers
                      </small>
                    </span>
                    <span className={s.score}>{l.score.toLocaleString('en-IN')}</span>
                  </motion.li>
                ))}
                {!meListed && (
                  <>
                    <li className={s.gap} aria-hidden>
                      ···
                    </li>
                    <li className={`${s.row} ${s.rowMe}`}>
                      <span className={s.rank}>{me.rank}</span>
                      <span className={s.avatar}>{initials(me.name)}</span>
                      <span className={s.text}>
                        <strong>{me.name} (you)</strong>
                        <small>
                          {where(me)} · {me.tasks} tasks · {me.farmers} farmers
                        </small>
                      </span>
                      <span className={s.score}>{me.score.toLocaleString('en-IN')}</span>
                    </li>
                  </>
                )}
              </ol>
            </motion.div>
          </AnimatePresence>
        )}
        <div className={s.gutter}>
          <Note tone="info" icon={<Info aria-hidden />}>
            Points and ranks are set by Kisani Urjaa from reviewed tasks. They update after each review.
          </Note>
        </div>
      </div>
    </Screen>
  );
}
