import { useState } from 'react';
import { Type, Bell, Bookmark, ClipboardList, FlaskConical, HelpCircle, Info, KeyRound, Languages, LayoutTemplate, LogOut, MessageCircle, Pencil, Repeat, ScrollText, ShieldCheck, Sprout, Tractor } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { actions, useStore, LANGUAGE_NAMES, TEXT_SIZES } from '@/services/store';
import { Toggle } from '../../ui/Controls';
import { formatPhone, monthYear } from '@/lib/format';
import { counterpartPath } from '@/app/DirectionSwitcher';
import { Screen } from '../../layout/Screen';
import { Avatar, Row, RowGroup, StatusTag } from '../../ui/Blocks';
import { Button, IconButton } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Cascade, Rise } from '../../motion/Reveal';
import { useNav } from '../../nav';
import { visibleLands } from '../../content/lands';
import s from './Account.module.css';

export default function Account() {
  const language = useStore((st) => st.prefs.language);
  const nav = useNav();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const profile = useStore((st) => st.profile);
  const session = useStore((st) => st.session);
  const bookmarks = useStore((st) => st.bookmarks.length);
  const unread = useStore((st) => st.unreadNotifications.length);
  const allLands = useStore((st) => st.lands);
  const lands = visibleLands(allLands);
  const photo = useStore((st) => st.profileDetails.photo);
  const [logout, setLogout] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const textSize = useStore((st) => st.prefs.text);
  const acres = lands.reduce((a, l) => a + l.areaAcres, 0);

  return (
    <Screen title="Me" variant="masthead" kicker="Your account" tabRoot>
      <Cascade className={s.page}>
        <Rise>
          <section className={s.profile} aria-label="Profile">
            <div className={s.profileTop}>
              <Avatar name={profile.name} size={56} verified={session.verified} night photo={(!session.demo && photo) || undefined} />
              <div className={s.who}>
                <h2 className={s.name}>{profile.name}</h2>
                <p className={s.phone}>{formatPhone(session.phone || profile.phone)}</p>
                <p className={s.since}>
                  @{profile.username} · {profile.village}, {profile.district} · since {monthYear(profile.memberSince)}
                </p>
              </div>
              <IconButton label="Edit profile" to="/account/profile" className={s.edit}>
                <Pencil />
              </IconButton>
            </div>
            <div className={s.profileFoot}>
              {session.verified ? (
                <StatusTag tone="success" icon={<ShieldCheck aria-hidden />}>
                  Verified
                </StatusTag>
              ) : (
                <Button size="sm" variant="accent" onClick={() => nav('/account/verify')}>
                  Verify number
                </Button>
              )}
              <dl className={s.stats}>
                <div>
                  <dd>{lands.length}</dd>
                  <dt>Fields</dt>
                </div>
                <div>
                  <dd>{acres}</dd>
                  <dt>Acres</dt>
                </div>
                <div>
                  <dd>{bookmarks}</dd>
                  <dt>Saved</dt>
                </div>
              </dl>
            </div>
          </section>
        </Rise>

        <Rise>
          <RowGroup title="My farm">
            <Row icon={<Sprout />} title="My fields" value={String(lands.length)} to="/lands" />
            <Row icon={<ClipboardList />} title="My forms" subtitle="Season records" to="/forms" />
            <Row icon={<Tractor />} title="Farm machinery" subtitle="Machines you own" to="/account/machinery" />
          </RowGroup>
        </Rise>
        <Rise>
          <RowGroup title="Activity">
            <Row icon={<Bookmark />} title="My bookmarks" value={bookmarks ? String(bookmarks) : undefined} to="/bookmarks" />
            <Row icon={<Bell />} title="Notifications" value={unread ? `${unread} new` : undefined} to="/notifications" />
          </RowGroup>
        </Rise>
        <Rise>
          <RowGroup title="Preferences">
            <Row icon={<Languages />} title="Language" value={LANGUAGE_NAMES[language]} to="/account/language" />
            <Row icon={<Type />} title="Text size" value={TEXT_SIZES.find((x) => x.value === textSize)?.label} onClick={() => setTextOpen(true)} />
            {session.verified && <Row icon={<KeyRound />} title="Change password" to="/account/password" />}
          </RowGroup>
        </Rise>
        <Rise>
          <RowGroup title="Help">
            <Row icon={<HelpCircle />} title="Help & FAQs" to="/account/help" />
            <Row icon={<MessageCircle />} title="Contact us" to="/account/contact" />
            <Row icon={<Info />} title="About Kisani Urjaa" subtitle="Credits and photo slots" to="/account/about" />
            <Row icon={<ScrollText />} title="Privacy policy" to="/account/legal/privacy" />
            <Row icon={<ScrollText />} title="Terms & conditions" to="/account/legal/terms" />
          </RowGroup>
        </Rise>
        <Rise>
          <RowGroup title="Design review">
            {import.meta.env.VITE_ONLY_D3 !== '1' && <Row icon={<Repeat />} title="Switch to Direction 01" subtitle="Same screen in the illustrated design" onClick={() => navigate(counterpartPath(pathname))} />}
            <Row icon={<FlaskConical />} title="Prototype controls" subtitle="Verification, offline, slow network, empty states" to="/account/prototype" />
            <Row icon={<LayoutTemplate />} title="Design system" subtitle="Field Journal colours, type, components, motion" to="/design-system" />
          </RowGroup>
        </Rise>
        <Rise>
          <RowGroup>
            <Row icon={<LogOut />} title="Log out" danger onClick={() => setLogout(true)} chevron={false} />
          </RowGroup>
        </Rise>
        <p className={s.version}>Kisani Urjaa 2.0 · Ver 3 “Field Journal v3” · prototype</p>
      </Cascade>

      <Sheet
        open={logout}
        onClose={() => setLogout(false)}
        variant="dialog"
        icon={<LogOut />}
        tone="danger"
        title="Log out?"
        description="You’ll need your mobile number to log in again. Bookmarks stay on this phone."
        footer={
          <>
            <Button
              variant="danger"
              block
              onClick={() => {
                setLogout(false);
                actions.signOut();
                nav('/login', { replace: true });
              }}
            >
              Log out
            </Button>
            <Button variant="secondary" block onClick={() => setLogout(false)} data-autofocus>
              Stay logged in
            </Button>
          </>
        }
      />
      <Sheet open={textOpen} onClose={() => setTextOpen(false)} title="Text size" description="Changes the size of text across the app. Saved on this phone.">
        <div className="fj3-stack" style={{ ['--gap' as string]: '16px' }}>
          <Toggle label="Text size" value={textSize} onChange={(v) => actions.setPrefs({ text: v })} options={TEXT_SIZES.map((x) => ({ value: x.value, label: x.label }))} />
          <div className={s.textPreview} aria-hidden>
            <strong>Good day to spray</strong>
            <span>Calm and dry. Spray in the morning or late afternoon.</span>
          </div>
          <Button block onClick={() => setTextOpen(false)}>
            Done
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
