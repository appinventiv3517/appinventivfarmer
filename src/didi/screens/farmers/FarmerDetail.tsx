import { useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Circle, MapPin, MapPinOff, MessageCircle, Phone, Sprout } from 'lucide-react';
import { formatDate, formatPhone, initials } from '@/lib/format';
import { SectionTabs } from '@/d3/ui/Controls';
import { SWAP } from '@/d3/motion/tokens';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Skel, StatusTag } from '../../ui/Blocks';
import { Facts, Ring, Section, useLoad } from '../../ui/Kit';
import { PROFILE_STEPS, completion, farmerById, type FarmerLand } from '../../data/farmers';
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

  if (!f)
    return (
      <Screen title="Farmer" backTo="/farmers">
        <EmptyState animation="search" title="Farmer not found" body={`No farmer with ID ${id} is registered in your cluster.`} action={<Button to="/farmers">See all farmers</Button>} />
      </Screen>
    );
  const pct = completion(f);
  const crops = f.lands.filter((l) => l.crop).map((l) => ({ ...l.crop!, land: l.name, acres: l.areaAcres }));
  const acres = f.lands.reduce((a, l) => a + l.areaAcres, 0);

  return (
    <Screen title={f.name} backTo="/farmers">
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
                </>
              )}
              {tab === 'land' && (
                <Section title={`Registered land · ${acres} acres`} id="rl">
                  {f.lands.length ? f.lands.map((l) => <LandCard key={l.id} land={l} />) : <EmptyState animation="pin" title="No land registered" body="Add land on your next visit to this farmer." compact />}
                </Section>
              )}
              {tab === 'address' && (
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
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </Screen>
  );
}
