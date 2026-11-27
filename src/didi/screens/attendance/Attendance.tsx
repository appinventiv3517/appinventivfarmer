import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, LogIn, LogOut, MapPin } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/format';
import { SWAP } from '@/d3/motion/tokens';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { ErrorState, Skel, StatusTag } from '../../ui/Blocks';
import { Section, useLoad } from '../../ui/Kit';
import { useDidi, useToday } from '../../store';
import { hoursLabel, sampleAttendance, workedMinutes, type AttendanceDay } from '../../data/attendance';
import { isoDay, startOfDay } from '../../data/dates';
import { CheckSheet } from './CheckSheet';
import s from './Attendance.module.css';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
type Mark = 'present' | 'absent' | 'off' | 'today' | 'future' | 'none';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Attendance() {
  const now = useClock();
  const today = useToday();
  const local = useDidi((st) => st.attendance);
  const load = useLoad('attendance');
  const [sheet, setSheet] = useState<'in' | 'out' | null>(null);
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const records = useMemo(() => {
    const map = new Map<string, AttendanceDay>();
    sampleAttendance().forEach((d) => map.set(d.date, d));
    local.forEach((d) => map.set(d.date, d));
    return map;
  }, [local]);

  const month = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return d;
  }, [now, offset]);
  const todayIso = isoDay(now);

  const days = useMemo(() => {
    const first = (month.getDay() + 6) % 7;
    const len = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: { iso: string; day: number; mark: Mark }[] = [];
    for (let i = 0; i < first; i++) cells.push({ iso: `x${i}`, day: 0, mark: 'none' });
    for (let d = 1; d <= len; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      const iso = isoDay(date);
      const rec = records.get(iso);
      const mark: Mark = iso === todayIso ? 'today' : date > startOfDay(now) ? 'future' : date.getDay() === 0 ? 'off' : rec?.in ? 'present' : rec ? 'absent' : 'none';
      cells.push({ iso, day: d, mark });
    }
    return cells;
  }, [month, records, todayIso, now]);

  const marked = days.filter((d) => d.day);
  const present = marked.filter((d) => d.mark === 'present' || (d.mark === 'today' && today?.in)).length;
  const absent = marked.filter((d) => d.mark === 'absent').length;
  const mins = marked.map((d) => records.get(d.iso)).filter((r): r is AttendanceDay => !!r?.in && !!r.out).map((r) => workedMinutes(r));
  const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0;
  const pickedRec = picked ? records.get(picked) : undefined;
  const recent = [...records.values()].filter((r) => r.date !== todayIso).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  const state = !today?.in ? 'none' : today.out ? 'done' : 'working';
  const canPrev = offset > -1;

  return (
    <Screen title="Attendance" variant="masthead" tabRoot kicker={formatDate(now, 'weekday')} deck="Check in with a selfie and your location when you start field work, and check out when you finish.">
      <div className={s.page}>
        <motion.div className={`${s.today} ${s[`today_${state}`]}`} layout>
          <div className={s.todayTop}>
            <span className={s.kicker}>Today</span>
            <StatusTag tone={state === 'none' ? 'warning' : 'success'}>{state === 'none' ? 'Not checked in' : state === 'working' ? 'Checked in' : 'Present'}</StatusTag>
          </div>
          <p className={s.clock}>{formatTime(now)}</p>
          <div className={s.times}>
            <span>
              <small>Check in</small>
              <strong>{today?.in ? formatTime(today.in) : '--:--'}</strong>
            </span>
            <span>
              <small>Check out</small>
              <strong>{today?.out ? formatTime(today.out) : '--:--'}</strong>
            </span>
            <span>
              <small>Worked</small>
              <strong>{today?.in ? hoursLabel(workedMinutes(today, now)) : '—'}</strong>
            </span>
          </div>
          {today?.place && (
            <p className={s.place}>
              <MapPin aria-hidden /> {today.place}
              {today.inProof && (
                <span className="didi-num">
                  · {today.inProof.lat.toFixed(4)}° N, {today.inProof.lng.toFixed(4)}° E{today.inProof.sampleLocation ? ' (sample)' : ''}
                </span>
              )}
            </p>
          )}
          {(today?.inProof || today?.outProof) && (
            <div className={s.selfies}>
              {today.inProof && <img src={today.inProof.selfie} alt="Check-in selfie" />}
              {today.outProof && <img src={today.outProof.selfie} alt="Check-out selfie" />}
              <small>{today.outProof ? 'Check-in and check-out selfies' : 'Check-in selfie'}</small>
            </div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={state} {...SWAP}>
              {state === 'none' && (
                <Button size="lg" block icon={<LogIn aria-hidden />} onClick={() => setSheet('in')}>
                  Check in
                </Button>
              )}
              {state === 'working' && (
                <Button size="lg" block variant="secondary" icon={<LogOut aria-hidden />} onClick={() => setSheet('out')}>
                  Check out
                </Button>
              )}
              {state === 'done' && <p className={s.doneLine}>Your day is recorded. See you tomorrow.</p>}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {load.status === 'loading' ? (
          <div className={s.gutter}>
            <Skel h={340} r="var(--r-xl)" />
          </div>
        ) : load.status === 'error' ? (
          <ErrorState error={load.error} onRetry={load.retry} />
        ) : (
          <>
            <Section title="Calendar" id="cal">
              <div className={s.calendar}>
                <div className={s.calHead}>
                  <button type="button" className={s.calNav} onClick={() => (setOffset(offset - 1), setPicked(null))} disabled={!canPrev} aria-label="Previous month">
                    <ChevronLeft aria-hidden />
                  </button>
                  <strong aria-live="polite">{new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(month)}</strong>
                  <button type="button" className={s.calNav} onClick={() => (setOffset(offset + 1), setPicked(null))} disabled={offset >= 0} aria-label="Next month">
                    <ChevronRight aria-hidden />
                  </button>
                </div>
                <div className={s.grid} role="grid" aria-label="Attendance calendar">
                  {WEEK.map((w, i) => (
                    <span key={i} className={s.wd} aria-hidden>
                      {w}
                    </span>
                  ))}
                  {days.map((d) =>
                    d.day ? (
                      <button key={d.iso} type="button" className={`${s.day} ${s[`m_${d.mark}`]} ${picked === d.iso ? s.picked : ''}`} onClick={() => setPicked(d.iso === picked ? null : d.iso)} disabled={d.mark === 'future'} aria-label={`${formatDate(`${d.iso}T00:00`, 'long')}: ${d.mark === 'present' ? 'present' : d.mark === 'absent' ? 'absent' : d.mark === 'off' ? 'Sunday, off' : d.mark === 'today' ? 'today' : 'no record'}`}>
                        {d.day}
                      </button>
                    ) : (
                      <span key={d.iso} />
                    ),
                  )}
                </div>
                <div className={s.legend}>
                  <span>
                    <i className={s.lgPresent} /> Present
                  </span>
                  <span>
                    <i className={s.lgAbsent} /> Absent
                  </span>
                  <span>
                    <i className={s.lgOff} /> Off
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {picked && (
                    <motion.div className={s.pick} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <div className={s.pickInner}>
                        <strong>{formatDate(`${picked}T00:00`, 'long')}</strong>
                        {pickedRec?.in ? (
                          <span>
                            {formatTime(pickedRec.in)} – {pickedRec.out ? formatTime(pickedRec.out) : 'not checked out'} · {hoursLabel(workedMinutes(pickedRec))} · {pickedRec.place}
                          </span>
                        ) : (
                          <span>{new Date(`${picked}T00:00`).getDay() === 0 ? 'Sunday · off' : picked === todayIso ? 'Not checked in yet' : pickedRec ? 'Absent' : 'No record'}</span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className={s.stats}>
                <span>
                  <strong>{present}</strong>
                  <small>Present</small>
                </span>
                <span>
                  <strong>{absent}</strong>
                  <small>Absent</small>
                </span>
                <span>
                  <strong>{avg ? hoursLabel(avg).replace(' min', 'm').replace(' h ', 'h ') : '—'}</strong>
                  <small>Avg. day</small>
                </span>
              </div>
            </Section>

            <Section title="Recent days" id="hist">
              <ul className={s.history}>
                {recent.map((r) => (
                  <li key={r.date}>
                    <span className={s.hDate}>
                      <strong>{new Date(`${r.date}T00:00`).getDate()}</strong>
                      <small>{new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(new Date(`${r.date}T00:00`))}</small>
                    </span>
                    <span className={s.hText}>
                      {r.in ? (
                        <>
                          <strong>
                            {formatTime(r.in)} – {r.out ? formatTime(r.out) : '—'}
                          </strong>
                          <small>
                            {hoursLabel(workedMinutes(r))} · {r.place}
                          </small>
                        </>
                      ) : (
                        <strong>No check-in</strong>
                      )}
                    </span>
                    <StatusTag tone={r.in ? 'success' : 'danger'}>{r.in ? 'Present' : 'Absent'}</StatusTag>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}
      </div>
      <CheckSheet kind={sheet ?? 'in'} open={!!sheet} onClose={() => setSheet(null)} />
    </Screen>
  );
}
