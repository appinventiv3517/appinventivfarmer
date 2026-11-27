import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useTransform } from 'framer-motion';
import { ArrowUpRight, Bell, CalendarClock, ChevronRight, CloudSun, Languages, LogIn, LogOut, MapPin, QrCode, Tractor, Trophy, Wallet } from 'lucide-react';
import { formatCurrency, formatTime, greeting, initials } from '@/lib/format';
import { LANGUAGE_CATALOG } from '@/services/store';
import { Sheet } from '@/d3/ui/Sheet';
import { useToast } from '@/d3/ui/Toast';
import { conditionLabel, sprayAdvisory } from '@/lib/weather';
import markUrl from '@/assets/brand/kisani-urjaa-mark.webp';
import { Photo } from '@/d3/photo/Photo';
import { RevealText, InView } from '@/d3/motion/Reveal';
import { Toggle } from '@/d3/ui/Controls';
import { TAP } from '@/d3/motion/tokens';
import hs from '@/d3/screens/home/Home.module.css';
import { Screen, useScreenScroll } from '../../layout/Screen';
import { IconButton, Button } from '../../ui/Button';
import { SectionHead, Skel, StatusTag } from '../../ui/Blocks';
import { Bar } from '../../ui/Kit';
import { didi, useDidi, useToday } from '../../store';
import { LanguageList } from '../profile/LanguageList';
import { FARMERS, completion } from '../../data/farmers';
import { STATUS_LABEL, STATUS_TONE, progressOf, tabOf } from '../../data/tasks';
import { TRANSACTIONS, filterTxns, totals } from '../../data/money';
import { board, MY_MANDAL, type Scope } from '../../data/leaderboard';
import { hoursLabel, workedMinutes } from '../../data/attendance';
import { dayDiff } from '../../data/dates';
import { useWeather } from '../../data/useWeather';
import { CheckSheet } from '../attendance/CheckSheet';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { dueLabel } from '../tasks/TaskCard';
import { BOOKINGS, BOOKING_LABEL, BOOKING_TONE } from '../../data/bookings';
import s from './Home.module.css';

/** Language switch in the hero: opens the language list and applies the choice at once. */
function LanguageButton() {
  const toast = useToast();
  const lang = useDidi((st) => st.session.language);
  const [open, setOpen] = useState(false);
  const current = LANGUAGE_CATALOG.find((l) => l.code === lang) ?? LANGUAGE_CATALOG[0];
  const pick = (code: string) => {
    setOpen(false);
    if (code === lang) return;
    didi.setLanguage(code);
    toast({ message: `Language set to ${LANGUAGE_CATALOG.find((l) => l.code === code)?.english}`, tone: 'success' });
  };
  return (
    <>
      <IconButton label={`Change language (now ${current.english})`} variant="glass" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Languages aria-hidden />
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} kicker="App language" title="Choose your language">
        <LanguageList value={lang} onChange={pick} />
        <p className={s.langNote}>Screens are in English in this prototype. Your choice is saved, and screens will switch once translations are reviewed by native speakers.</p>
      </Sheet>
    </>
  );
}

function Hero({ name, unread }: { name: string; unread: number }) {
  const scrollY = useScreenScroll();
  const y = useTransform(scrollY, [0, 380], [0, 120]);
  const textY = useTransform(scrollY, [0, 240], [0, -36]);
  const fade = useTransform(scrollY, [0, 200], [1, 0]);
  const date = useMemo(() => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), []);
  const first = name.split(' ')[0];
  return (
    <header className={`${hs.hero} ${s.hero}`}>
      <motion.div className={hs.heroMedia} style={{ y }}>
        <Photo id="kisani-didi-meeting" ratio="fill" shade="full" priority label="hero" />
      </motion.div>
      <div className={hs.heroTop}>
        <Link to={to('/profile/info/about')} className={hs.brand} aria-label="About Kisani Urjaa">
          <img src={markUrl} alt="" />
        </Link>
        <div className={hs.heroActions}>
          <IconButton label="Notifications" variant="glass" to="/notifications" badge={unread}>
            <Bell />
          </IconButton>
          <LanguageButton />
        </div>
      </div>
      <motion.div className={hs.heroText} style={{ y: textY, opacity: fade }}>
        <p className={hs.dateline}>
          <span>Today</span> {date}
        </p>
        <RevealText text={`${greeting()}, ${first}`} className={`${hs.hello} ${s.hello} didi-reveal`} delay={0.25} />
        <p className={s.role}>Kisani Didi · {useDidi((st) => st.profile.cluster)}</p>
      </motion.div>
    </header>
  );
}

function AttendanceCard() {
  const today = useToday();
  const [sheet, setSheet] = useState<'in' | 'out' | null>(null);
  const nav = useNav();
  const state = !today?.in ? 'none' : today.out ? 'done' : 'working';
  return (
    <div className={s.attend}>
      <button type="button" className={s.attendInfo} onClick={() => nav('/attendance')} aria-label="Open attendance">
        <span className={`${s.attendDot} ${s[`dot_${state}`]}`} aria-hidden />
        <span className={s.attendText}>
          <span className={s.kicker}>Attendance</span>
          <strong>{state === 'none' ? 'Not checked in yet' : state === 'working' ? `Checked in at ${formatTime(today!.in!)}` : 'Day complete'}</strong>
          <small>{state === 'none' ? 'Take a selfie and share your location to check in.' : state === 'working' ? `${hoursLabel(workedMinutes(today!))} so far · ${today!.place}` : `${formatTime(today!.in!)} – ${formatTime(today!.out!)} · ${hoursLabel(workedMinutes(today!))}`}</small>
        </span>
      </button>
      {state === 'none' && (
        <Button className={s.attendBtn} icon={<LogIn aria-hidden />} onClick={() => setSheet('in')}>
          Check in
        </Button>
      )}
      {state === 'working' && (
        <Button className={s.attendBtn} variant="secondary" icon={<LogOut aria-hidden />} onClick={() => setSheet('out')}>
          Check out
        </Button>
      )}
      {state === 'done' && <StatusTag tone="success">Present</StatusTag>}
      <CheckSheet kind={sheet ?? 'in'} open={!!sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

function WeatherCard() {
  const w = useWeather();
  if (!w)
    return (
      <div className={s.card} aria-busy="true" aria-label="Loading weather">
        <Skel w={140} h={14} />
        <Skel h={40} style={{ marginTop: 12 }} />
      </div>
    );
  const rainMax = Math.max(0, ...w.hourly.map((h) => h.rainChance));
  const tip = sprayAdvisory(w.current, rainMax);
  return (
    <div className={s.card}>
      <div className={s.wxTop}>
        <span className={s.wxPlace}>
          <MapPin aria-hidden /> {w.locationName}
        </span>
        {w.source === 'sample' && <span className={s.sample}>Sample forecast</span>}
      </div>
      <div className={s.wxMain}>
        <span className={s.temp}>{Math.round(w.current.tempC)}°</span>
        <span className={s.wxText}>
          <strong>{conditionLabel(w.current.code)}</strong>
          <small>
            Rain {w.current.rainChance}% · Wind {Math.round(w.current.windKph)} km/h · Humidity {w.current.humidity}%
          </small>
        </span>
        <CloudSun className={s.wxIcon} aria-hidden />
      </div>
      <div className={`${s.tip} ${s[`tip_${tip.tone}`]}`}>
        <strong>Tip for your farmers · {tip.title}</strong>
        <span>{tip.text}</span>
      </div>
    </div>
  );
}

function LeaderCard() {
  const [scope, setScope] = useState<Scope>('state');
  const { list, me } = board(scope, 'month');
  return (
    <div className={s.card}>
      <div className={s.rankTop}>
        <div>
          <span className={s.kicker}>Your rank this month</span>
          <p className={s.rank}>
            #{me.rank} <small>of {me.of.toLocaleString('en-IN')} in {scope === 'mandal' ? `${MY_MANDAL} mandal` : scope === 'state' ? 'Maharashtra' : 'India'}</small>
          </p>
        </div>
        <Trophy className={s.trophy} aria-hidden />
      </div>
      <Toggle label="Leaderboard" value={scope} onChange={setScope} options={[{ value: 'mandal', label: 'Mandal' }, { value: 'state', label: 'State' }, { value: 'national', label: 'National' }]} />
      <ol className={s.podium}>
        {list.slice(0, 3).map((l) => (
          <li key={l.id} className={s.podiumRow}>
            <span className={`${s.medal} ${s[`medal${l.rank}`]}`}>{l.rank}</span>
            <span className={s.podiumName}>
              {l.me ? `${l.name} (you)` : l.name}
              <small>{scope === 'mandal' ? l.village ?? l.district : scope === 'state' ? l.district : l.state}</small>
            </span>
            <span className={s.podiumScore}>{l.score.toLocaleString('en-IN')}</span>
          </li>
        ))}
      </ol>
      <Link to={to('/leaderboard')} className={s.cardLink}>
        Full leaderboard <ArrowUpRight aria-hidden />
      </Link>
    </div>
  );
}

export default function Home() {
  const nav = useNav();
  const profile = useDidi((st) => st.profile);
  const unread = useDidi((st) => st.unread.length);
  const tasks = useDidi((st) => st.tasks);
  const open = tasks.filter((t) => tabOf(t.status) !== 'closed');
  const fresh = tasks.filter((t) => t.status === 'pending').length;
  const ongoing = tasks.filter((t) => tabOf(t.status) === 'progress').length;
  const upcoming = [...open].filter((t) => t.status === 'pending' || t.status === 'in_progress').sort((a, b) => a.dueOn.localeCompare(b.dueOn)).slice(0, 2);
  const inReview = tasks.filter((t) => t.status === 'in_review' || t.status === 'resubmitted').length;
  const farmerVerify = useDidi((st) => st.farmerVerify);
  const unverified = FARMERS.filter((f) => (farmerVerify[f.id]?.status ?? f.verification.status) !== 'verified').length;
  const awaiting = BOOKINGS.filter((b) => b.status === 'pending' || b.status === 'cancel_requested').length;
  const latestBooking = [...BOOKINGS].sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt))[0];
  const needsAction = tasks.find((t) => t.status === 'rejected');
  const month = filterTxns(TRANSACTIONS, 'all', '30');
  const sum = totals(month);

  return (
    <Screen title="Home" variant="bare" tabRoot lightTop heroHeight={380}>
      <div className={s.home}>
        <Hero name={profile.name} unread={unread} />
        <div className={s.overlap}>
          <AttendanceCard />
        </div>

        <InView className={s.scanWrap}>
          <motion.button type="button" whileTap={TAP} className={s.scan} onClick={() => nav('/qr')}>
            <span className={s.scanIcon}>
              <QrCode aria-hidden />
            </span>
            <span className={s.scanText}>
              <strong>My QR code</strong>
              <small>Show your Kisani Didi ID · {profile.partnerId}</small>
            </span>
            <ChevronRight aria-hidden className={s.scanArrow} />
          </motion.button>
        </InView>

        <section className={s.section} aria-labelledby="tasks-h">
          <SectionHead id="tasks-h" title="My tasks" meta={`${fresh} pending · ${ongoing} in progress${inReview ? ` · ${inReview} in review` : ''}`} to="/tasks" action="See all" />
          {needsAction && (
            <Link to={to(`/tasks/${needsAction.id}`)} className={s.alert}>
              <strong>Needs your action</strong>
              <span>{needsAction.title} was returned for changes. {dueLabel(needsAction.dueOn)}.</span>
            </Link>
          )}
          <ul className={s.taskList}>
            {upcoming.map((t) => {
              const d = dayDiff(t.dueOn);
              return (
                <li key={t.id}>
                  <Link to={to(`/tasks/${t.id}`)} className={s.task}>
                    <span className={s.taskTop}>
                      <StatusTag tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</StatusTag>
                      <span className={`${s.due} ${d <= 2 ? s.dueSoon : ''}`}>
                        <CalendarClock aria-hidden /> {dueLabel(t.dueOn)}
                      </span>
                    </span>
                    <strong className={s.taskTitle}>{t.title}</strong>
                    <span className={s.taskMeta}>
                      {t.done} of {t.target} {t.unit}
                    </span>
                    <Bar value={progressOf(t)} label={`${progressOf(t)}% done`} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={s.section} aria-labelledby="farmers-h">
          <SectionHead id="farmers-h" title="My farmers" meta={`${FARMERS.length} farmers · ${unverified} not verified`} to="/farmers" action="View all" />
          <div className={s.farmers}>
            {FARMERS.slice(0, 4).map((f) => (
              <Link key={f.id} to={to(`/farmers/${f.id}`)} className={s.farmer}>
                <span className={s.farmerAvatar}>{initials(f.name)}</span>
                <span className={s.farmerName}>{f.name.split(' ')[0]}</span>
                <span className={s.farmerVillage}>{f.village}</span>
                <span className={s.farmerPct}>
                  <Bar value={completion(f)} label={`Profile ${completion(f)}% complete`} tone={completion(f) === 100 ? 'green' : 'clay'} />
                  <small>{completion(f)}%</small>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className={s.section} aria-labelledby="bk-h">
          <SectionHead id="bk-h" title="Bookings" meta={`${awaiting} awaiting a decision`} to="/bookings" action="See all" />
          {latestBooking && (
            <Link to={to(`/bookings/${latestBooking.id}`)} className={`${s.card} ${s.booking} ${s.gutterCard}`}>
              <span className={s.bookingIcon}>
                <Tractor aria-hidden />
              </span>
              <span className={s.bookingText}>
                <span className={s.kicker}>Latest update · #{latestBooking.id}</span>
                <strong>{FARMERS.find((f) => f.id === latestBooking.farmerId)?.name}</strong>
                <span>
                  <StatusTag tone={BOOKING_TONE[latestBooking.status]}>{BOOKING_LABEL[latestBooking.status]}</StatusTag>
                </span>
              </span>
              <ChevronRight aria-hidden className={s.bookingChev} />
            </Link>
          )}
        </section>

        <section className={s.section} aria-labelledby="wx-h">
          <SectionHead id="wx-h" title="Weather in your area" />
          <div className={s.gutter}>
            <WeatherCard />
          </div>
        </section>

        <section className={s.section} aria-labelledby="money-h">
          <SectionHead id="money-h" title="My transactions" meta="Last 30 days" to="/transactions" action="History" />
          <Link to={to('/transactions')} className={`${s.card} ${s.money} ${s.gutterCard}`}>
            <span className={s.moneyIcon}>
              <Wallet aria-hidden />
            </span>
            <span className={s.moneyMain}>
              <span className={s.kicker}>Credited</span>
              <strong className="didi-num">{formatCurrency(sum.credited)}</strong>
            </span>
            <span className={s.moneySide}>
              <span className={s.kicker}>Pending</span>
              <strong className="didi-num">{formatCurrency(sum.pending)}</strong>
            </span>
          </Link>
        </section>

        <section className={s.section} aria-labelledby="lb-h">
          <SectionHead id="lb-h" title="Leaderboard" />
          <div className={s.gutter}>
            <LeaderCard />
          </div>
        </section>
      </div>
    </Screen>
  );
}
