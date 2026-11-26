import type { ReactNode } from 'react';
import { ArrowRight, Bell, CheckCircle2, Info, Languages, Plus, Search, ShieldCheck, Sprout, TriangleAlert } from 'lucide-react';
import { buildContent } from '@/data/content';
import { buildEvents } from '@/data/events';
import { buildOrders } from '@/data/orders';
import { buildBookings } from '@/data/bookings';
import { buildLands } from '@/data/lands';
import { apiError } from '@/services/api';
import { Button, IconButton } from '../../ui/Button';
import { BackButton } from '../../ui/BackButton';
import { TextArea, TextField, SelectField } from '../../ui/Field';
import { Chip, Counter, SectionTabs, Switch, Toggle } from '../../ui/Controls';
import { Accordion, Avatar, EmptyState, ErrorState, Loading, Note, Receipt, Row, RowGroup, SectionHead, Segments, Skel, StatusTag, Timeline, Tracker } from '../../ui/Blocks';
import { SearchBox } from '../../ui/SearchBox';
import { CoverStory, EventLine, EventPoster, FieldTile, GuideCard, IndexStory, OrderTicket, BookingTicket, StoryRow, VideoTile } from '../../content/Cards';
import { PickerField } from '../profile-setup/Picker';
import { PasswordField, PhoneField, UserIdField } from '../onboarding/fields';

/**
 * Figma kit (development builds only). Renders every Ver 3 component in its
 * variants; each specimen is tagged `data-figma-component="Set/Prop=Value, …"`
 * for scripts/figma/capture.cjs, which turns them into Figma components.
 */
const noop = () => undefined;

function C({ name, width, children }: { name: string; width?: number; children: ReactNode }) {
  return (
    <div data-figma-component={name} style={{ width, display: width ? 'block' : 'inline-flex', alignSelf: 'flex-start' }}>
      {children}
    </div>
  );
}

function Group({ title, children, row }: { title: string; children: ReactNode; row?: boolean }) {
  return (
    <section data-figma-group={title} style={{ display: 'flex', flexDirection: row ? 'row' : 'column', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', padding: '20px 0', borderTop: '1px solid var(--fj3-line)' }}>
      <h2 style={{ width: '100%', font: 'var(--fj3-heading)' }}>{title}</h2>
      {children}
    </section>
  );
}

export default function FigmaKit() {
  const content = buildContent();
  const news = content.filter((c) => c.kind === 'news');
  const video = content.find((c) => c.kind === 'video')!;
  const article = content.find((c) => c.kind === 'article')!;
  const events = buildEvents();
  const orders = buildOrders();
  const bookings = buildBookings();
  const lands = buildLands();
  const W = 345;
  return (
    <div className="fj3-gutter" style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '24px 24px 80px', background: 'var(--fj3-bg)' }} data-scroll-root>
      <h1 style={{ font: 'var(--fj3-title)' }}>Ver 3 components</h1>

      <Group title="Buttons" row>
        {(['primary', 'accent', 'secondary', 'tonal', 'ghost', 'danger'] as const).flatMap((v) =>
          (['lg', 'md', 'sm'] as const).map((sz) => (
            <C key={v + sz} name={`Button/Variant=${v}, Size=${sz}, State=default`}>
              <Button variant={v} size={sz} icon={sz === 'sm' ? <Plus aria-hidden /> : undefined}>
                {sz === 'sm' ? 'Add field' : 'Continue'}
              </Button>
            </C>
          )),
        )}
        <C name="Button/Variant=primary, Size=lg, State=loading">
          <Button size="lg" loading>
            Sending code…
          </Button>
        </C>
        <C name="Button/Variant=primary, Size=lg, State=disabled">
          <Button size="lg" disabled>
            Continue
          </Button>
        </C>
        <C name="Button/Variant=primary, Size=lg, State=block" width={W}>
          <Button size="lg" block iconRight={<ArrowRight aria-hidden />}>
            Next
          </Button>
        </C>
      </Group>

      <Group title="Icon buttons and Back" row>
        {(['surface', 'plain', 'night', 'glass'] as const).map((v) => (
          <C key={v} name={`Icon button/Variant=${v}, Badge=no`}>
            <div style={{ padding: 6, background: v === 'glass' || v === 'night' ? '#3a2e28' : undefined, borderRadius: 999 }}>
              <IconButton label="Search" variant={v}>
                <Search />
              </IconButton>
            </div>
          </C>
        ))}
        <C name="Icon button/Variant=glass, Badge=yes">
          <div style={{ padding: 6, background: '#3a2e28', borderRadius: 999 }}>
            <IconButton label="Notifications" variant="glass" badge={4}>
              <Bell />
            </IconButton>
          </div>
        </C>
        {(['surface', 'night', 'image'] as const).map((t) => (
          <C key={t} name={`Back button/Tone=${t}, Kind=back`}>
            <div style={{ padding: 6, background: t === 'surface' ? undefined : '#3a2e28', borderRadius: 999 }}>
              <BackButton tone={t} onClick={noop} />
            </div>
          </C>
        ))}
        <C name="Back button/Tone=image, Kind=close">
          <div style={{ padding: 6, background: '#3a2e28', borderRadius: 999 }}>
            <BackButton tone="image" close onClick={noop} />
          </div>
        </C>
      </Group>

      <Group title="Fields">
        <C name="Text field/State=empty, Kind=text" width={W}>
          <TextField label="Full name" required placeholder="Enter full name" value="" onChange={noop} />
        </C>
        <C name="Text field/State=filled, Kind=text" width={W}>
          <TextField label="Full name" required value="Ram Prasad Yadav" onChange={noop} />
        </C>
        <C name="Text field/State=error, Kind=text" width={W}>
          <TextField label="Full name" required value="Ram 2" onChange={noop} error="A full name cannot contain numbers." />
        </C>
        <C name="Text field/State=read-only, Kind=text" width={W}>
          <TextField label="State" readOnly value="Maharashtra" hint="Filled in from your PIN code." />
        </C>
        <C name="Text field/State=optional, Kind=text" width={W}>
          <TextField label="Email ID" optional placeholder="Enter email ID" value="" onChange={noop} />
        </C>
        <C name="Text field/State=empty, Kind=phone" width={W}>
          <PhoneField label="Mobile number" required value="" onChange={noop} hint="10 digits, without 0 or +91" />
        </C>
        <C name="Text field/State=filled, Kind=phone" width={W}>
          <PhoneField label="Mobile number" required value="98765 43210" onChange={noop} />
        </C>
        <C name="Text field/State=empty, Kind=user ID" width={W}>
          <UserIdField value="" onChange={noop} />
        </C>
        <C name="Text field/State=empty, Kind=password" width={W}>
          <PasswordField label="Password" placeholder="Enter password" value="" onChange={noop} />
        </C>
        <C name="Text field/State=error, Kind=password" width={W}>
          <PasswordField label="Confirm password" value="abcd@1234" onChange={noop} error="Passwords do not match." />
        </C>
        <C name="Text area/State=filled" width={W}>
          <TextArea label="Complete address" required maxLength={200} value="11/24, Aamrapali, near Hanuman temple" onChange={noop} />
        </C>
        <C name="Select/State=empty" width={W}>
          <SelectField label="Season" value="" placeholder="Choose a season" onChange={noop} options={[{ value: 'kharif', label: 'Kharif' }]} />
        </C>
        <C name="Picker/State=empty" width={W}>
          <PickerField label="District" required value="" onChange={noop} options={[{ value: 'Buldhana', label: 'Buldhana' }]} placeholder="Select district" />
        </C>
        <C name="Picker/State=filled" width={W}>
          <PickerField label="District" required value="Buldhana" onChange={noop} options={[{ value: 'Buldhana', label: 'Buldhana' }]} />
        </C>
        <C name="Picker/State=error" width={W}>
          <PickerField label="District" required value="" onChange={noop} options={[]} placeholder="Select district" error="Choose your district." />
        </C>
        <C name="Search/State=empty" width={W}>
          <SearchBox value="" onChange={noop} placeholder="Search news stories" />
        </C>
      </Group>

      <Group title="Controls" row>
        <C name="Chip/State=selected">
          <Chip selected>All statuses</Chip>
        </C>
        <C name="Chip/State=default">
          <Chip count={4}>Pending</Chip>
        </C>
        <C name="Tabs/Size=lg" width={W}>
          <SectionTabs label="Learn" value="news" onChange={noop} items={[{ value: 'news', label: 'News', count: 8 }, { value: 'videos', label: 'Videos', count: 6 }, { value: 'articles', label: 'Articles', count: 6 }]} />
        </C>
        <C name="Tabs/Size=md" width={W}>
          <SectionTabs label="Log in with" size="md" value="otp" onChange={noop} items={[{ value: 'otp', label: 'With OTP' }, { value: 'pw', label: 'User ID & Password' }]} />
        </C>
        <C name="Segmented toggle" width={W}>
          <Toggle label="Unit" value="kg" onChange={noop} options={[{ value: 'kg', label: 'Kilograms' }, { value: 't', label: 'Tonnes' }]} />
        </C>
        <C name="Switch/State=on">
          <Switch checked onChange={noop} label="Active" />
        </C>
        <C name="Switch/State=off">
          <Switch checked={false} onChange={noop} label="Active" />
        </C>
        <C name="Counter">
          <Counter value={2} onChange={noop} label="Tractors" />
        </C>
      </Group>

      <Group title="Status and feedback" row>
        {(['success', 'warning', 'danger', 'info', 'live', 'neutral'] as const).map((t) => (
          <C key={t} name={`Status tag/Tone=${t}`}>
            <StatusTag tone={t}>{t === 'success' ? 'Approved' : t === 'warning' ? 'Pending approval' : t === 'danger' ? 'Rejected' : t === 'info' ? 'Upcoming' : t === 'live' ? 'Live now' : 'Completed'}</StatusTag>
          </C>
        ))}
        {(['info', 'success', 'warning', 'danger', 'neutral'] as const).map((t) => (
          <C key={t} name={`Note/Tone=${t}`} width={W}>
            <Note tone={t} icon={t === 'success' ? <CheckCircle2 aria-hidden /> : t === 'warning' || t === 'danger' ? <TriangleAlert aria-hidden /> : <Info aria-hidden />} title={t === 'info' ? 'Prototype' : 'Heads up'}>
              No SMS is sent. Use the code 123456.
            </Note>
          </C>
        ))}
        <C name="Avatar/Kind=initials, Verified=yes">
          <Avatar name="Ram Prasad Yadav" size={56} verified night />
        </C>
        <C name="Avatar/Kind=initials, Verified=no">
          <Avatar name="Sumita Kumari" size={48} />
        </C>
        <C name="Progress segments" width={200}>
          <Segments done={3} total={8} label="3 of 8 steps" />
        </C>
        <C name="Skeleton/Kind=card" width={W}>
          <Skel h={120} r="var(--r-xl)" />
        </C>
        <C name="Loading">
          <Loading />
        </C>
      </Group>

      <Group title="Lists and steps">
        <C name="Row group" width={W}>
          <RowGroup title="My farm">
            <Row icon={<Sprout />} title="My fields" value="3" onClick={noop} />
            <Row icon={<ShieldCheck />} title="Verification" subtitle="Your number is verified" onClick={noop} />
            <Row icon={<Languages />} title="Language" value="English" onClick={noop} />
          </RowGroup>
        </C>
        <C name="Section head" width={W}>
          <SectionHead title="My fields" meta="3 registered · 50 acres" to="/lands" action="See all" inset={false} />
        </C>
        <C name="Tracker" width={W}>
          <Tracker steps={[{ label: 'Placed', meta: '22 Nov', state: 'done' }, { label: 'Approved', meta: '23 Nov', state: 'current' }, { label: 'Dispatched', state: 'upcoming' }, { label: 'Delivered', state: 'upcoming' }]} />
        </C>
        <C name="Timeline" width={W}>
          <Timeline items={[{ title: 'Land preparation', meta: 'Submitted', state: 'done' }, { title: 'Sowing', meta: 'In progress', state: 'current' }, { title: 'Water management', state: 'upcoming' }]} />
        </C>
        <C name="Receipt" width={W}>
          <Receipt rows={[{ label: 'FOM', value: '250 kg' }, { label: 'Price', value: '₹100 / kg' }, { label: 'Total', value: '₹25,100' }]} />
        </C>
        <C name="Accordion/State=closed" width={W}>
          <Accordion title="How do I book straw clearing?">Open New, then Book a service.</Accordion>
        </C>
        <C name="Accordion/State=open" width={W}>
          <Accordion title="How do I book straw clearing?" defaultOpen>
            Open New, then Book a service.
          </Accordion>
        </C>
      </Group>

      <Group title="Empty and error states">
        <C name="Empty state/Kind=no results" width={W}>
          <EmptyState title="No stories match" body="Try another word, or clear the date filter." action={<Button variant="secondary">Clear filters</Button>} />
        </C>
        <C name="Empty state/Kind=no fields" width={W}>
          <EmptyState animation="crate" title="Add a field first" body="Bookings are made for a registered field." action={<Button>Add a field</Button>} compact />
        </C>
        <C name="Error state/Kind=offline" width={W}>
          <ErrorState error={apiError('offline')} onRetry={noop} />
        </C>
        <C name="Error state/Kind=server" width={W}>
          <ErrorState error={apiError('server')} onRetry={noop} />
        </C>
      </Group>

      <Group title="Cards">
        <C name="Card/Kind=cover story" width={W}>
          <CoverStory item={news[0]} bleed={false} />
        </C>
        <C name="Card/Kind=story row" width={W}>
          <StoryRow item={news[1]} />
        </C>
        <C name="Card/Kind=index story" width={W}>
          <IndexStory item={news[2]} index={1} />
        </C>
        <C name="Card/Kind=video" width={W}>
          <VideoTile item={video} />
        </C>
        <C name="Card/Kind=guide">
          <GuideCard item={article} />
        </C>
        <C name="Card/Kind=event poster" width={W}>
          <EventPoster event={events[1]} />
        </C>
        <C name="Card/Kind=event line" width={W}>
          <EventLine event={events[1]} />
        </C>
        <C name="Card/Kind=order ticket" width={W}>
          <OrderTicket order={orders[0]} />
        </C>
        <C name="Card/Kind=booking ticket" width={W}>
          <BookingTicket booking={bookings[0]} />
        </C>
        <C name="Card/Kind=field tile">
          <FieldTile land={lands[0]} />
        </C>
      </Group>
    </div>
  );
}
