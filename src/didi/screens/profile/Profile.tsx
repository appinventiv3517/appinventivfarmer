import { useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Bell, CircleHelp, FileText, FlaskConical, Info, KeyRound, Languages, LogOut, Phone, ScanFace, ShieldAlert, ShieldCheck, Trophy, Type, UserRound, Wallet, Clock, Tractor } from 'lucide-react';
import { LANGUAGE_CATALOG } from '@/services/store';
import { initials } from '@/lib/format';
import { Sheet } from '@/d3/ui/Sheet';
import { Toggle } from '@/d3/ui/Controls';
import { SPRING_SOFT } from '@/d3/motion/tokens';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Row, RowGroup, StatusTag } from '../../ui/Blocks';
import { Ring } from '../../ui/Kit';
import { TEXT_SIZES, didi, useDidi, type TextSize } from '../../store';
import { useNav } from '../../nav';
import { profilePct } from './profileCompletion';
import s from './Profile.module.css';

export const VERIFY_LABEL = { none: 'Not verified', submitted: 'In review', verified: 'Verified' } as const;
export const VERIFY_TONE = { none: 'warning', submitted: 'info', verified: 'success' } as const;

export default function Profile() {
  const nav = useNav();
  const p = useDidi((st) => st.profile);
  const v = useDidi((st) => st.verification);
  const lang = useDidi((st) => st.session.language);
  const unread = useDidi((st) => st.unread.length);
  const text = useDidi((st) => st.prefs.text);
  const [logout, setLogout] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const pct = profilePct(p, v);
  const langName = LANGUAGE_CATALOG.find((l) => l.code === lang)?.native ?? 'English';

  return (
    <Screen title="Profile" variant="masthead" tabRoot kicker="Kisani Didi" deck="Your details, settings and help.">
      <div className={s.page}>
        <motion.button type="button" className={s.card} onClick={() => nav('/profile/me')} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}>
          <span className={s.photo}>{p.photo ? <img src={p.photo} alt="" /> : initials(p.name)}</span>
          <span className={s.cardText}>
            <strong>{p.name}</strong>
            <span>
              {p.role} · {p.partnerId}
            </span>
            <StatusTag tone={VERIFY_TONE[v.status]} icon={v.status === 'verified' ? <BadgeCheck aria-hidden /> : v.status === 'submitted' ? <Clock aria-hidden /> : <ShieldAlert aria-hidden />}>
              {VERIFY_LABEL[v.status]}
            </StatusTag>
          </span>
          <Ring value={pct} size={56} stroke={5} label={`Profile ${pct}% complete`} tone={pct === 100 ? 'green' : 'clay'} />
        </motion.button>

        {v.status === 'none' && (
          <div className={s.banner}>
            <ScanFace aria-hidden />
            <span>
              <strong>Verify your identity</strong>
              <small>Scan an ID document to complete your profile.</small>
            </span>
            <Button size="sm" to="/profile/verify">
              Start
            </Button>
          </div>
        )}

        <RowGroup title="Account">
          <Row icon={<UserRound aria-hidden />} title="My profile" subtitle={`${pct}% complete`} to="/profile/me" />
          <Row icon={<ShieldCheck aria-hidden />} title="Profile verification" value={VERIFY_LABEL[v.status]} to="/profile/verify" />
          <Row icon={<Languages aria-hidden />} title="Change language" value={langName} to="/profile/language" />
          <Row icon={<KeyRound aria-hidden />} title="Change password" to="/profile/password" />
          <Row icon={<Type aria-hidden />} title="Text size" value={TEXT_SIZES.find((t) => t.value === text)?.label} onClick={() => setTextOpen(true)} />
        </RowGroup>
        <RowGroup title="My work">
          <Row icon={<Tractor aria-hidden />} title="Bookings" to="/bookings" />
          <Row icon={<Wallet aria-hidden />} title="My transactions" to="/transactions" />
          <Row icon={<Trophy aria-hidden />} title="Leaderboard" to="/leaderboard" />
          <Row icon={<Bell aria-hidden />} title="Notifications" value={unread ? `${unread} new` : undefined} to="/notifications" />
        </RowGroup>
        <RowGroup title="Help">
          <Row icon={<CircleHelp aria-hidden />} title="FAQs" to="/profile/faqs" />
          <Row icon={<Phone aria-hidden />} title="Contact us" to="/profile/contact" />
        </RowGroup>
        <RowGroup title="About">
          <Row icon={<Info aria-hidden />} title="About us" to="/profile/info/about" />
          <Row icon={<FileText aria-hidden />} title="Privacy policy" to="/profile/info/privacy" />
          <Row icon={<FileText aria-hidden />} title="Terms & conditions" to="/profile/info/terms" />
          <Row icon={<FlaskConical aria-hidden />} title="Prototype controls" subtitle="Loading and error states, demo review" to="/profile/prototype" />
        </RowGroup>
        <RowGroup>
          <Row icon={<LogOut aria-hidden />} title="Log out" danger onClick={() => setLogout(true)} chevron={false} />
        </RowGroup>
        <p className={s.version}>Kisani Didi App · prototype</p>
      </div>

      <Sheet open={textOpen} onClose={() => setTextOpen(false)} kicker="Display" title="Text size">
        <div className="fj3-stack" style={{ ['--gap' as string]: '16px' }}>
          <Toggle label="Text size" value={text} onChange={(t: TextSize) => didi.setText(t)} options={TEXT_SIZES} />
          <p className={s.preview}>Tasks, farmers and attendance will use this size.</p>
          <Button block onClick={() => setTextOpen(false)}>
            Done
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={logout}
        onClose={() => setLogout(false)}
        variant="dialog"
        tone="danger"
        icon={<LogOut aria-hidden />}
        title="Log out?"
        description="Your saved progress stays on this phone. You’ll need your Partner ID and password, or an OTP, to log in again."
        footer={
          <div className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
            <Button block variant="danger" onClick={() => (didi.signOut(), setLogout(false), nav('/login', { replace: true }))}>
              Log out
            </Button>
            <Button block variant="ghost" onClick={() => setLogout(false)}>
              Cancel
            </Button>
          </div>
        }
      />
    </Screen>
  );
}
