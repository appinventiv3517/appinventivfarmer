import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, ClipboardList, Circle, MapPin, MapPinOff, MessageCircle, Phone, Sprout, Tractor } from 'lucide-react';
import { formatDate, formatPhone, initials } from '@/lib/format';
import { SectionTabs } from '@/d3/ui/Controls';
import { SWAP } from '@/d3/motion/tokens';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Skel, StatusTag } from '../../ui/Blocks';
import { Facts, Ring, Section, useLoad } from '../../ui/Kit';
import { PROFILE_STEPS, VERIFY_LABEL, VERIFY_TONE, completion, farmerById, type FarmerLand } from '../../data/farmers';
import { BOOKING_LABEL, BOOKING_TONE, bookingsFor } from '../../data/bookings';
import { useDidi, useFarmerVerification } from '../../store';
import { STEPS, isComplete, submittedCount } from '../../data/collection';
import { CycleProgress, StepGrid } from '../collection/parts';
import cs from '../collection/Collection.module.css';
import { to } from '../../paths';
import { VerifyCard } from './VerifyCard';
import s from './Farmers.module.css';

type Tab = 'overview' | 'land' | 'address';

function Plot({ land }: { land: FarmerLand }) {
  const pts = land.shape.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className={s.plot} role="img" aria-label={land.geo ? `Boundary of ${land.name}, ${land.geo.points} points` : `${land.name}, boundary not captured`}>
      <defs>
        <pattern id={`g-${land.id}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 8 0" stroke="rgba(61,106,58,0.18)" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="var(--fj3-surface-2)" />
      <polygon points={pts} fill={land.geo ? `url(#g-${land.id})` : 'none'} stroke={land.geo ? 'var(--fj3-success-solid)' : 'var(--fj3-fg-3)'} strokeWidth="2" strokeDasharray={land.geo ? undefined : '4 3'} strokeLinejoin="round" />
      {land.geo && land.shape.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="var(--fj3-success-solid)" stroke="#fff" strokeWidth="1" />)}
    </svg>
  );
}

function LandCard({ land }: { land: FarmerLand }) {
  return (
    <article className={s.land}>
      <Plot land={land} />
      <div className={s.landBody}>
        <div className={s.landTop}>
          <strong>{land.name}</strong>
          {land.geo ? (
            <StatusTag tone="success" icon={<MapPin aria-hidden />}>
              Geo-tagged
            </StatusTag>
          ) : (
            <StatusTag tone="warning" icon={<MapPinOff aria-hidden />}>
              Not geo-tagged
            </StatusTag>
          )}
        </div>
        <Facts
          items={[
            { label: 'Survey no.', value: land.surveyNo },
            { label: 'Area', value: `${land.areaAcres} acres` },
            { label: 'Ownership', value: land.ownership },
            { label: 'Crop', value: land.crop ? `${land.crop.name} · ${land.crop.season}` : 'Not recorded' },
            ...(land.geo ? [{ label: 'Location', value: <span className="didi-num">{land.geo.lat.toFixed(4)}° N, {land.geo.lng.toFixed(4)}° E</span> }, { label: 'Tagged on', value: `${formatDate(land.geo.taggedOn, 'medium')} · ${land.geo.points} points` }] : []),
          ]}
        />
      </div>
    </article>
  );
}

export default function FarmerDetail() {
  const { id = '' } = useParams();
  const f = farmerById(id);
  const [params, setParams] = useSearchParams();
  const tab = (['overview', 'land', 'address'].includes(params.get('tab') ?? '') ? params.get('tab') : 'overview') as Tab;
  const load = useLoad(`farmer-${id}`);
  const verification = useFarmerVerification(f);
  const allCycles = useDidi((st) => st.collection);

  if (!f)
    return (
      <Screen title="Farmer" backTo="/farmers">
        <EmptyState animation="search" title="Farmer not found" body={`No farmer with ID ${id} is registered in your cluster.`} action={<Button to="/farmers">See all farmers</Button>} />
      </Screen>
    );
  const pct = completion(f);
  const crops = f.lands.filter((l) => l.crop).map((l) => ({ ...l.crop!, land: l.name, acres: l.areaAcres }));
  const acres = f.lands.reduce((a, l) => a + l.areaAcres, 0);
  const bookings = bookingsFor(f.id);
  const cycles = allCycles.filter((c) => c.farmerId === f.id).sort((a, b) => b.no - a.no);
  const current = cycles.find((c) => !isComplete(c)) ?? cycles[0];
  const tagged = f.lands.filter((l) => l.geo);

  return (
    <Screen
      title={f.name}
      backTo="/farmers"
      footer={
        <Button size="lg" block icon={<ClipboardList aria-hidden />} to={`/farmers/${f.id}/collection`}>
          Data collection forms
        </Button>
      }
    >
      {load.status === 'loading' ? (
        <div className={s.detail} aria-busy="true" aria-label="Loading farmer">
          <Skel h={168} r="var(--r-xl)" />
          <Skel h={44} r="var(--r-pill)" />
          <Skel h={220} r="var(--r-xl)" />
        </div>
      ) : load.status === 'error' ? (
        <ErrorState error={load.error} onRetry={load.retry} />
      ) : (
        <div className={s.detail}>
          <motion.header className={s.head} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className={s.bigAvatar} aria-hidden>
              {initials(f.name)}
            </span>
            <div className={s.headText}>
              <h2>{f.name}</h2>
              <span className={s.id}>{f.id}</span>
              {verification && <StatusTag tone={VERIFY_TONE[verification.status]}>{VERIFY_LABEL[verification.status]}</StatusTag>}
              <span className={s.meta}>
                {f.village}, {f.mandal} · Registered {formatDate(f.registeredOn, 'medium')}
              </span>
            </div>
            <div className={s.headActions}>
              <Button size="sm" href={`tel:${f.phone}`} icon={<Phone aria-hidden />}>
                Call
              </Button>
              <Button size="sm" variant="secondary" href={`https://wa.me/91${f.phone}`} icon={<MessageCircle aria-hidden />}>
                WhatsApp
              </Button>
              <span className={s.phone}>{formatPhone(f.phone)}</span>
            </div>
          </motion.header>

          <SectionTabs
            label="Farmer details"
            size="md"
            value={tab}
            onChange={(v) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true })}
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'land', label: 'Land & crops', count: f.lands.length },
              { value: 'address', label: 'Address' },
            ]}
          />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} {...SWAP} className={s.tabBody}>
              {tab === 'overview' && (
                <>
                  <VerifyCard f={f} />
                  <Section title="Data collection" id="dc">
                    {current ? (
                      <Link to={to(`/farmers/${f.id}/collection/${current.id}`)} className={cs.cycle} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <CycleProgress cycle={current} />
                        <StepGrid cycle={current} />
                        <span className={cs.stepMeta}>
                          {cycles.length} {cycles.length === 1 ? 'cycle' : 'cycles'} · {submittedCount(current)} of {STEPS.length} forms in cycle {current.no}
                        </span>
                      </Link>
                    ) : (
                      <EmptyState animation="records" title="No form cycles yet" body="Use Data collection forms below to start the first one." compact />
                    )}
                  </Section>
                  <Section title="Profile completion" id="pc">
                    <div className={s.completion}>
                      <Ring value={pct} size={76} stroke={7} label={`Profile ${pct}% complete`} tone={pct === 100 ? 'green' : 'clay'} />
                      <ul className={s.steps}>
                        {PROFILE_STEPS.map((st) => (
                          <li key={st.key} className={f.steps[st.key] ? s.stepDone : ''}>
                            {f.steps[st.key] ? <Check aria-hidden /> : <Circle aria-hidden />}
                            {st.label}
                            <span className="sr-only">{f.steps[st.key] ? 'done' : 'to do'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Section>
                  <Section title="Personal details" id="pd">
                    <Facts
                      items={[
                        { label: 'Farmer ID', value: f.id },
                        { label: 'Phone', value: formatPhone(f.phone) },
                        { label: 'Gender', value: f.gender },
                        { label: 'Age', value: `${f.age} years` },
                        { label: 'Registered land', value: f.lands.length ? `${f.lands.length} ${f.lands.length === 1 ? 'plot' : 'plots'} · ${acres} acres` : 'None yet' },
                        { label: 'Registered on', value: formatDate(f.registeredOn, 'medium') },
                        { label: 'Verification', value: verification ? VERIFY_LABEL[verification.status] : '—' },
                      ]}
                    />
                  </Section>
                  <Section title="Active crops" id="ac">
                    {crops.length ? (
                      <ul className={s.crops}>
                        {crops.map((c) => (
                          <li key={c.land}>
                            <Sprout aria-hidden />
                            <span>
                              <strong>{c.name}</strong>
                              <small>
                                {c.season} · {c.land}, {c.acres} acres · sown {formatDate(c.sown, 'short')}
                              </small>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState animation="sprout" title="No active crops" body="Crops are added from the farmer’s land records." compact />
                    )}
                  </Section>
                  {bookings.length > 0 && (
                    <Section title="Bookings" id="bk">
                      <ul className={s.bookings}>
                        {bookings.map((b) => (
                          <li key={b.id}>
                            <Link to={to(`/bookings/${b.id}`)} className={s.bookingRow}>
                              <Tractor aria-hidden />
                              <span>
                                <strong>
                                  #{b.id} · {b.landName}
                                </strong>
                                <small>Visit {formatDate(b.date, 'medium')}</small>
                                <span>
                                  <StatusTag tone={BOOKING_TONE[b.status]}>{BOOKING_LABEL[b.status]}</StatusTag>
                                </span>
                              </span>
                              <ChevronRight aria-hidden className={s.rowChev} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </>
              )}
              {tab === 'land' && (
                <Section title={`Registered land · ${acres} acres`} id="rl">
                  {f.lands.length ? f.lands.map((l) => <LandCard key={l.id} land={l} />) : <EmptyState animation="pin" title="No land registered" body="Add land on your next visit to this farmer." compact />}
                </Section>
              )}
              {tab === 'address' && (
                <>
                <Section title="Address" id="ad">
                  <Facts
                    items={[
                      { label: 'Address', value: f.address },
                      { label: 'Village', value: f.village },
                      { label: 'Mandal', value: f.mandal },
                      { label: 'District', value: f.district },
                      { label: 'State', value: f.state },
                      { label: 'Pincode', value: f.pincode },
                    ]}
                  />
                </Section>
                <Section title="Location" id="lc">
                  {tagged.length ? (
                    <Facts
                      items={tagged.map((l) => ({ label: l.name, value: <span className="didi-num">{l.geo!.lat.toFixed(4)}° N, {l.geo!.lng.toFixed(4)}° E</span> }))}
                    />
                  ) : (
                    <EmptyState animation="pin" title="No geo-tagged land" body="Geo-tag the farmer’s land on your next visit to record its location." compact />
                  )}
                </Section>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </Screen>
  );
}
