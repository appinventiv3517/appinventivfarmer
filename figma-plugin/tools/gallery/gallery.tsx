/*
 * Component gallery used only by the Figma capture tool (not part of the app).
 * Renders every reusable component of both directions in each variant and
 * state, tagged with data-fig-component / data-fig-variant so capture.mjs can
 * turn them into Figma component sets with variant properties.
 *
 * Served by the Vite dev server at /figma-plugin/tools/gallery/index.html
 * (?d=d1 or ?d=d2).
 */
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ArrowRight, Plus, Bell, Search, Share2, Bookmark, Tractor, Sprout, FileText, Phone } from 'lucide-react';
import '@/styles/tokens.css';
import '@/styles/base.css';
import { buildContent } from '@/data/content';
import { buildEvents } from '@/data/events';
import { buildOrders } from '@/data/orders';
import { buildBookings } from '@/data/bookings';
import { buildLands } from '@/data/lands';
import { apiError } from '@/services/api';

/* Direction 01 */
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Chip } from '@/components/ui/Chip';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch, StatusBadge, Avatar, SectionHeader, ProgressRing, ProgressBar } from '@/components/ui/Misc';
import { TextField, TextArea, SelectField } from '@/components/ui/TextField';
import { SearchField } from '@/components/ui/SearchField';
import { Callout, ListRow, ListGroup, Stepper, DetailGrid, Timeline } from '@/components/ui/Blocks';
import { EmptyState, ErrorState, StaleBanner } from '@/components/ui/States';
import { Skeleton, SkeletonRows, SkeletonCards } from '@/components/ui/Skeleton';
import { FeatureCard, MediaRow, CompactCard, DateTile, EventCard, EventRow, LandCard, AddLandCard, OrderCard, BookingCard } from '@/components/content/Cards';
import { ToastProvider as D1Toasts } from '@/components/ui/Toast';

/* Direction 02 */
import '@/d2/styles/tokens.css';
import '@/d2/styles/base.css';
import { Button as FjButton, IconButton as FjIconButton } from '@/d2/ui/Button';
import { Chip as FjChip, SectionTabs, Toggle, Switch as FjSwitch, Counter } from '@/d2/ui/Controls';
import { TextField as FjTextField, TextArea as FjTextArea, SelectField as FjSelect } from '@/d2/ui/Field';
import { SearchBox } from '@/d2/ui/SearchBox';
import { StatusTag, Note, Skel, SkelList, EmptyState as FjEmpty, ErrorState as FjError, StaleNote, Loading, Avatar as FjAvatar, Segments, Tracker, Receipt, Row, RowGroup, SectionHead, Timeline as FjTimeline } from '@/d2/ui/Blocks';
import { CoverStory, StoryRow, IndexStory, VideoTile, GuideCard, EventPoster, EventLine, OrderTicket, BookingTicket, FieldTile } from '@/d2/content/Cards';
import { ToastProvider as D2Toasts } from '@/d2/ui/Toast';

const noop = () => undefined;
const now = new Date();
const content = buildContent(now);
const events = buildEvents(now);
const orders = buildOrders(now);
const bookings = buildBookings(now);
const lands = buildLands(now);
const news = content.filter((c) => c.kind === 'news');
const articles = content.filter((c) => c.kind === 'article');
const videos = content.filter((c) => c.kind === 'video');
const byStatus = <T extends { status: string }>(list: T[], s: string) => list.find((x) => x.status === s) ?? list[0];

/** One component variant. `wide` gives it a phone-width content box. */
function G({ set, v, wide, w, children, dark }: { set: string; v: string; wide?: boolean; w?: number; children: ReactNode; dark?: boolean }) {
  return (
    <div className="fig-item" data-fig-component={set} data-fig-variant={v} style={{ display: wide || w ? 'block' : 'inline-block', width: w ?? (wide ? 345 : undefined), background: dark ? '#2a2420' : undefined, padding: dark ? 12 : undefined, borderRadius: dark ? 16 : undefined }}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fig-section" data-fig-section={title}>
      <h2 className="fig-h">{title}</h2>
      <div className="fig-grid">{children}</div>
    </section>
  );
}

const VARIANTS = ['primary', 'accent', 'secondary', 'tonal', 'ghost', 'danger'] as const;

function D1() {
  return (
    <div className="fig-page" data-dir="d1">
      <Section title="Button">
        {VARIANTS.map((variant) =>
          (['lg', 'md', 'sm'] as const).map((size) => (
            <G key={variant + size} set="Button" v={`Variant=${variant}, Size=${size}, State=Default`}>
              <Button variant={variant} size={size} icon={<Plus aria-hidden />}>
                Place order
              </Button>
            </G>
          )),
        )}
        {VARIANTS.map((variant) => (
          <G key={variant + 'd'} set="Button" v={`Variant=${variant}, Size=md, State=Disabled`}>
            <Button variant={variant} disabled icon={<Plus aria-hidden />}>
              Place order
            </Button>
          </G>
        ))}
        {VARIANTS.map((variant) => (
          <G key={variant + 'l'} set="Button" v={`Variant=${variant}, Size=md, State=Loading`}>
            <Button variant={variant} loading>
              Place order
            </Button>
          </G>
        ))}
        <G set="Button" v="Variant=glass, Size=md, State=Default" dark>
          <Button variant="glass">Watch now</Button>
        </G>
        <G set="Button block" v="Variant=primary" wide>
          <Button variant="primary" block iconRight={<ArrowRight aria-hidden />}>
            Continue
          </Button>
        </G>
        <G set="Button block" v="Variant=secondary" wide>
          <Button variant="secondary" block>
            Cancel
          </Button>
        </G>
      </Section>
      <Section title="Icon button">
        {(['surface', 'plain', 'tonal', 'glass', 'onImage'] as const).map((variant) =>
          (['lg', 'md', 'sm'] as const).map((size) => (
            <G key={variant + size} set="Icon button" v={`Variant=${variant}, Size=${size}`} dark={variant === 'glass' || variant === 'onImage'}>
              <IconButton variant={variant} size={size} aria-label="Notifications">
                <Bell aria-hidden />
              </IconButton>
            </G>
          )),
        )}
      </Section>
      <Section title="Chip">
        <G set="Chip" v="State=Default, Count=No">
          <Chip onClick={noop}>Approved</Chip>
        </G>
        <G set="Chip" v="State=Selected, Count=No">
          <Chip selected onClick={noop}>
            Approved
          </Chip>
        </G>
        <G set="Chip" v="State=Default, Count=Yes">
          <Chip count={3} onClick={noop}>
            Pending
          </Chip>
        </G>
        <G set="Chip" v="State=Selected, Count=Yes">
          <Chip selected count={3} onClick={noop}>
            Pending
          </Chip>
        </G>
      </Section>
      <Section title="Controls">
        <G set="Segmented control" v="Selected=First" wide>
          <SegmentedControl label="Network" value="normal" onChange={noop} segments={[{ value: 'normal', label: 'Normal' }, { value: 'slow', label: 'Slow' }, { value: 'offline', label: 'Offline' }]} />
        </G>
        <G set="Segmented control" v="Selected=Last" wide>
          <SegmentedControl label="Network" value="offline" onChange={noop} segments={[{ value: 'normal', label: 'Normal' }, { value: 'slow', label: 'Slow' }, { value: 'offline', label: 'Offline' }]} />
        </G>
        <G set="Switch" v="State=On">
          <Switch checked onChange={noop} label="Switch" />
        </G>
        <G set="Switch" v="State=Off">
          <Switch checked={false} onChange={noop} label="Switch" />
        </G>
        <G set="Progress ring" v="Value=Partial">
          <ProgressRing value={3} total={8} label="3/8" />
        </G>
        <G set="Progress ring" v="Value=Complete">
          <ProgressRing value={8} total={8} label="8/8" />
        </G>
        <G set="Progress bar" v="Value=Partial" wide>
          <ProgressBar value={3} total={8} label="3 of 8 steps done" />
        </G>
        <G set="Stepper" v="Step=2" wide>
          <Stepper step={2} total={4} title="Choose a date" />
        </G>
      </Section>
      <Section title="Fields">
        <G set="Text field" v="State=Empty" wide>
          <TextField label="Quantity" placeholder="250" suffix="kg" onChange={noop} value="" />
        </G>
        <G set="Text field" v="State=Filled" wide>
          <TextField label="Quantity" suffix="kg" onChange={noop} value="250" />
        </G>
        <G set="Text field" v="State=Error" wide>
          <TextField label="Quantity" suffix="kg" onChange={noop} value="20" error="Minimum order is 50 kg." />
        </G>
        <G set="Text field" v="State=Hint" wide>
          <TextField label="Phone number" prefix="+91" onChange={noop} value="" placeholder="98765 43210" hint="We’ll send a 6-digit code by SMS." />
        </G>
        <G set="Text field" v="State=Disabled" wide>
          <TextField label="Village" onChange={noop} value="Ratanpur" disabled />
        </G>
        <G set="Text area" v="State=Filled" wide>
          <TextArea label="Delivery instructions" optional value="Call before coming. Our gate is next to the Hanuman temple." onChange={noop} maxLength={200} />
        </G>
        <G set="Select field" v="State=Placeholder" wide>
          <SelectField label="Crop" value="" onChange={noop} placeholder="Choose a crop" options={[{ value: 'paddy', label: 'Paddy' }]} />
        </G>
        <G set="Select field" v="State=Selected" wide>
          <SelectField label="Crop" value="paddy" onChange={noop} options={[{ value: 'paddy', label: 'Paddy' }]} />
        </G>
        <G set="Search field" v="State=Empty" wide>
          <SearchField value="" onChange={noop} placeholder="Search news, videos and guides" onFilter={noop} />
        </G>
        <G set="Search field" v="State=Filtered" wide>
          <SearchField value="soil" onChange={noop} placeholder="Search" onFilter={noop} activeFilters={2} />
        </G>
      </Section>
      <Section title="Status and feedback">
        {(['success', 'warning', 'danger', 'info', 'neutral', 'live'] as const).map((tone) => (
          <G key={tone} set="Status badge" v={`Tone=${tone}`}>
            <StatusBadge tone={tone}>{{ success: 'Approved', warning: 'Pending', danger: 'Rejected', info: 'Upcoming', neutral: 'Draft', live: 'Live now' }[tone]}</StatusBadge>
          </G>
        ))}
        {(['success', 'warning', 'danger', 'info', 'neutral'] as const).map((tone) => (
          <G key={tone} set="Callout" v={`Tone=${tone}`} wide>
            <Callout tone={tone} title={{ success: 'Order approved', warning: 'Verify your account', danger: 'Order rejected', info: 'For demos and testing', neutral: 'Good to know' }[tone]}>
              Explains what happened and what to do next, in plain words.
            </Callout>
          </G>
        ))}
        <G set="Stale banner" v="Reason=Offline" wide>
          <StaleBanner error={apiError('offline')} />
        </G>
      </Section>
      <Section title="States">
        {(
          [
            ['emptyBox', 'No orders yet', 'When you order FOM, it shows up here.'],
            ['calendar', 'No bookings yet', 'Book a machine and track it here.'],
            ['search', 'No matches', 'Try a shorter word or clear the filters.'],
            ['bell', 'No notifications', 'Updates about your orders and bookings appear here.'],
            ['bookmark', 'Nothing saved yet', 'Tap the bookmark on any story to keep it here.'],
            ['forms', 'No records yet', 'Your Kisani Didi adds season records here.'],
            ['sprout', 'No fields yet', 'Add a field to plan crops and book machines.'],
            ['pin', 'Location is off', 'Turn on location to see weather for your village.'],
            ['offline', 'You’re offline', 'Showing saved data. Check your connection.'],
            ['success', 'All done', 'Everything is up to date.'],
          ] as const
        ).map(([anim, title, body]) => (
          <G key={anim} set="Empty state" v={`Illustration=${anim}`} wide>
            <EmptyState animation={anim} title={title} body={body} action={<Button size="sm" variant="secondary">Refresh</Button>} />
          </G>
        ))}
        <G set="Error state" v="Reason=Offline" wide>
          <ErrorState error={apiError('offline')} onRetry={noop} />
        </G>
        <G set="Error state" v="Reason=Server" wide>
          <ErrorState error={apiError('server')} onRetry={noop} />
        </G>
        <G set="Skeleton" v="Kind=Rows" wide>
          <SkeletonRows count={3} />
        </G>
        <G set="Skeleton" v="Kind=Cards" wide>
          <SkeletonCards count={2} />
        </G>
        <G set="Skeleton" v="Kind=Line" wide>
          <Skeleton w="70%" h={18} />
        </G>
      </Section>
      <Section title="Lists and blocks">
        <G set="Avatar" v="Verified=Yes">
          <Avatar name="Ram Patil" verified />
        </G>
        <G set="Avatar" v="Verified=No">
          <Avatar name="Ram Patil" />
        </G>
        <G set="Section header" v="Action=Yes" wide>
          <SectionHeader title="Latest news" to="/learn" count={8} />
        </G>
        <G set="List group" v="Kind=Default" wide>
          <ListGroup title="Account">
            <ListRow icon={<FileText aria-hidden />} title="Profile" subtitle="Name, village and phone" to="/account/profile" />
            <ListRow icon={<Tractor aria-hidden />} title="My machinery" value="3" to="/account/machinery" />
            <ListRow icon={<Phone aria-hidden />} title="Sign out" danger onClick={noop} chevron={false} />
          </ListGroup>
        </G>
        <G set="Detail grid" v="Kind=Default" wide>
          <DetailGrid items={[{ label: 'Quantity', value: '250 kg' }, { label: 'Price', value: '₹100 / kg' }, { label: 'Total', value: '₹25,100', total: true, formula: '250 kg × ₹100 + ₹100' }]} />
        </G>
        <G set="Timeline" v="Kind=Order" wide>
          <Timeline items={[{ title: 'Order placed', meta: 'Yesterday, 6:20 PM', state: 'done' }, { title: 'Waiting for approval', meta: 'Usually within 2 days', state: 'current' }, { title: 'Dispatch', state: 'upcoming' }]} />
        </G>
      </Section>
      <Section title="Cards">
        <G set="Feature card" v="Kind=News" wide>
          <FeatureCard item={news[0]} />
        </G>
        <G set="Media row" v="Kind=Article" wide>
          <MediaRow item={articles[0]} />
        </G>
        <G set="Media row" v="Kind=Video" wide>
          <MediaRow item={videos[0]} />
        </G>
        <G set="Compact card" v="Tall=No" w={220}>
          <CompactCard item={news[1]} />
        </G>
        <G set="Compact card" v="Tall=Yes" w={220}>
          <CompactCard item={videos[1]} tall />
        </G>
        <G set="Date tile" v="Glass=No">
          <DateTile iso={events[0].start} />
        </G>
        <G set="Event card" v="Featured=Yes" wide>
          <EventCard event={events[0]} featured />
        </G>
        <G set="Event card" v="Featured=No" wide>
          <EventCard event={events[1]} />
        </G>
        <G set="Event row" v="Kind=Default" wide>
          <EventRow event={events[2]} />
        </G>
        <G set="Land card" v="Wide=No" w={240}>
          <LandCard land={lands[0]} />
        </G>
        <G set="Land card" v="Wide=Yes" wide>
          <LandCard land={lands[1]} wide />
        </G>
        <G set="Add land card" v="Kind=Default" w={240}>
          <AddLandCard />
        </G>
        {(['pending', 'approved', 'rejected'] as const).map((st) => (
          <G key={st} set="Order card" v={`Status=${st}`} wide>
            <OrderCard order={byStatus(orders, st)} />
          </G>
        ))}
        {(['pending', 'approved', 'rejected'] as const).map((st) => (
          <G key={st} set="Booking card" v={`Status=${st}`} wide>
            <BookingCard booking={byStatus(bookings, st)} />
          </G>
        ))}
      </Section>
    </div>
  );
}

const FJ_VARIANTS = ['primary', 'secondary', 'tonal', 'ghost', 'danger'] as const;

function D2() {
  return (
    <div className="fj fig-page" data-dir="d2">
      <Section title="Button">
        {FJ_VARIANTS.map((variant) =>
          (['lg', 'md', 'sm'] as const).map((size) => (
            <G key={variant + size} set="Button" v={`Variant=${variant}, Size=${size}, State=Default`}>
              <FjButton variant={variant} size={size} iconRight={<ArrowRight aria-hidden />}>
                Place order
              </FjButton>
            </G>
          )),
        )}
        {FJ_VARIANTS.map((variant) => (
          <G key={variant + 'd'} set="Button" v={`Variant=${variant}, Size=md, State=Disabled`}>
            <FjButton variant={variant} disabled>
              Place order
            </FjButton>
          </G>
        ))}
        {FJ_VARIANTS.map((variant) => (
          <G key={variant + 'l'} set="Button" v={`Variant=${variant}, Size=md, State=Loading`}>
            <FjButton variant={variant} loading>
              Place order
            </FjButton>
          </G>
        ))}
        {(['accent', 'glass'] as const).map((variant) => (
          <G key={variant} set="Button" v={`Variant=${variant}, Size=md, State=Default`} dark>
            <FjButton variant={variant as never}>{variant === 'accent' ? 'New' : 'Watch'}</FjButton>
          </G>
        ))}
        <G set="Button block" v="Variant=primary" wide>
          <FjButton block iconRight={<ArrowRight aria-hidden />}>
            Continue
          </FjButton>
        </G>
      </Section>
      <Section title="Icon button">
        {(['surface', 'plain', 'night', 'glass'] as const).map((variant) => (
          <G key={variant} set="Icon button" v={`Variant=${variant}, Badge=No`} dark={variant !== 'surface' && variant !== 'plain'}>
            <FjIconButton variant={variant} label="Search">
              <Search aria-hidden />
            </FjIconButton>
          </G>
        ))}
        <G set="Icon button" v="Variant=surface, Badge=Yes">
          <FjIconButton variant="surface" label="Notifications" badge={3}>
            <Bell aria-hidden />
          </FjIconButton>
        </G>
        <G set="Icon button" v="Variant=surface, Badge=No, Active=Yes">
          <FjIconButton variant="surface" label="Saved" active>
            <Bookmark aria-hidden />
          </FjIconButton>
        </G>
      </Section>
      <Section title="Controls">
        <G set="Chip" v="State=Default, Count=No">
          <FjChip onClick={noop}>Approved</FjChip>
        </G>
        <G set="Chip" v="State=Selected, Count=No">
          <FjChip selected onClick={noop}>
            Approved
          </FjChip>
        </G>
        <G set="Chip" v="State=Selected, Count=Yes">
          <FjChip selected count={3} onClick={noop}>
            Pending
          </FjChip>
        </G>
        <G set="Chip" v="State=Default, Count=Yes">
          <FjChip count={3} onClick={noop}>
            Pending
          </FjChip>
        </G>
        <G set="Section tabs" v="Size=lg" wide>
          <SectionTabs label="Journal" size="lg" value="news" onChange={noop} items={[{ value: 'news', label: 'News', count: 8 }, { value: 'videos', label: 'Videos', count: 6 }, { value: 'guides', label: 'Guides' }]} />
        </G>
        <G set="Section tabs" v="Size=md" wide>
          <SectionTabs label="Orders" size="md" value="orders" onChange={noop} items={[{ value: 'orders', label: 'FOM orders', count: 4 }, { value: 'bookings', label: 'Bookings', count: 4 }]} />
        </G>
        <G set="Toggle" v="Selected=First">
          <Toggle label="Unit" value="kg" onChange={noop} options={[{ value: 'kg', label: 'kg' }, { value: 'MT', label: 'Tonnes' }]} />
        </G>
        <G set="Toggle" v="Selected=Second">
          <Toggle label="Unit" value="MT" onChange={noop} options={[{ value: 'kg', label: 'kg' }, { value: 'MT', label: 'Tonnes' }]} />
        </G>
        <G set="Switch" v="State=On">
          <FjSwitch checked onChange={noop} label="Switch" />
        </G>
        <G set="Switch" v="State=Off">
          <FjSwitch checked={false} onChange={noop} label="Switch" />
        </G>
        <G set="Counter" v="Value=Some">
          <Counter value={2} onChange={noop} label="Tractors" />
        </G>
        <G set="Counter" v="Value=Zero">
          <Counter value={0} onChange={noop} label="Tractors" />
        </G>
      </Section>
      <Section title="Fields">
        <G set="Text field" v="State=Empty" wide>
          <FjTextField label="Quantity" placeholder="250" suffix="kg" value="" onChange={noop} />
        </G>
        <G set="Text field" v="State=Filled" wide>
          <FjTextField label="Quantity" suffix="kg" value="250" onChange={noop} />
        </G>
        <G set="Text field" v="State=Error" wide>
          <FjTextField label="Quantity" suffix="kg" value="20" onChange={noop} error="Minimum order is 50 kg." />
        </G>
        <G set="Text field" v="State=Hint" wide>
          <FjTextField label="Phone number" prefix="+91" value="" placeholder="98765 43210" onChange={noop} hint="We’ll send a 6-digit code by SMS." />
        </G>
        <G set="Text field" v="State=Disabled" wide>
          <FjTextField label="Village" value="Ratanpur" onChange={noop} disabled />
        </G>
        <G set="Text area" v="State=Filled" wide>
          <FjTextArea label="Delivery instructions" optional value="Call before coming. Our gate is next to the Hanuman temple." onChange={noop} maxLength={200} />
        </G>
        <G set="Select field" v="State=Placeholder" wide>
          <FjSelect label="Crop" value="" onChange={noop} placeholder="Choose a crop" options={[{ value: 'paddy', label: 'Paddy' }]} />
        </G>
        <G set="Select field" v="State=Selected" wide>
          <FjSelect label="Crop" value="paddy" onChange={noop} options={[{ value: 'paddy', label: 'Paddy' }]} />
        </G>
        <G set="Search box" v="State=Empty" wide>
          <SearchBox value="" onChange={noop} placeholder="Search stories, films and guides" onFilter={noop} />
        </G>
        <G set="Search box" v="State=Filtered" wide>
          <SearchBox value="soil" onChange={noop} placeholder="Search" onFilter={noop} filterLabel="Last 30 days" />
        </G>
      </Section>
      <Section title="Status and feedback">
        {(['success', 'warning', 'danger', 'info', 'live', 'neutral'] as const).map((tone) => (
          <G key={tone} set="Status tag" v={`Tone=${tone}`}>
            <StatusTag tone={tone}>{{ success: 'Approved', warning: 'Pending', danger: 'Rejected', info: 'Upcoming', live: 'Live now', neutral: 'Draft' }[tone]}</StatusTag>
          </G>
        ))}
        {(['success', 'warning', 'danger', 'info', 'neutral'] as const).map((tone) => (
          <G key={tone} set="Note" v={`Tone=${tone}`} wide>
            <Note tone={tone} title={{ success: 'Order approved', warning: 'Verify your account', danger: 'Order rejected', info: 'Note', neutral: 'Good to know' }[tone]}>
              Explains, never blames. Colour plus an icon or word.
            </Note>
          </G>
        ))}
        <G set="Stale note" v="Reason=Offline" wide>
          <StaleNote error={apiError('offline')} />
        </G>
        <G set="Loading" v="Kind=Default" wide>
          <Loading label="Loading your orders" />
        </G>
      </Section>
      <Section title="States">
        {(
          [
            ['crate', 'No orders yet', 'When you order FOM, it shows up here.'],
            ['calendar', 'No bookings yet', 'Book a machine and track it here.'],
            ['search', 'No matches', 'Try a shorter word or clear the filters.'],
            ['bell', 'No notifications', 'Updates about your orders and bookings appear here.'],
            ['bookmark', 'Nothing saved yet', 'Tap the bookmark on any story to keep it here.'],
            ['records', 'No records yet', 'Your Kisani Didi adds season records here.'],
            ['sprout', 'No fields yet', 'Add a field to plan crops and book machines.'],
            ['pin', 'Location is off', 'Turn on location to see weather for your village.'],
            ['offline', 'You’re offline', 'Showing saved data. Check your connection.'],
            ['weather', 'No forecast', 'We couldn’t load the weather right now.'],
            ['success', 'All done', 'Everything is up to date.'],
          ] as const
        ).map(([anim, title, body]) => (
          <G key={anim} set="Empty state" v={`Illustration=${anim}`} wide>
            <FjEmpty animation={anim} title={title} body={body} action={<FjButton size="sm" variant="secondary">Refresh</FjButton>} />
          </G>
        ))}
        <G set="Error state" v="Reason=Offline" wide>
          <FjError error={apiError('offline')} onRetry={noop} />
        </G>
        <G set="Error state" v="Reason=Server" wide>
          <FjError error={apiError('server')} onRetry={noop} />
        </G>
        <G set="Skeleton" v="Kind=List" wide>
          <SkelList count={3} />
        </G>
        <G set="Skeleton" v="Kind=Line" wide>
          <Skel w="70%" h={18} />
        </G>
      </Section>
      <Section title="Lists and blocks">
        <G set="Avatar" v="Verified=Yes">
          <FjAvatar name="Ram Patil" verified />
        </G>
        <G set="Avatar" v="Verified=No">
          <FjAvatar name="Ram Patil" />
        </G>
        <G set="Section head" v="Action=Yes" wide>
          <SectionHead title="Latest from the field" meta="03" to="/learn" />
        </G>
        <G set="Row group" v="Kind=Default" wide>
          <RowGroup title="Account">
            <Row icon={<FileText aria-hidden />} title="Profile" subtitle="Name, village and phone" to="/account/profile" />
            <Row icon={<Tractor aria-hidden />} title="My machinery" value="3" to="/account/machinery" />
            <Row icon={<Sprout aria-hidden />} title="Sign out" danger onClick={noop} chevron={false} />
          </RowGroup>
        </G>
        <G set="Segments" v="Progress=3 of 8" wide>
          <Segments done={3} total={8} label="3 of 8" />
        </G>
        <G set="Tracker" v="Stage=Approval" wide>
          <Tracker steps={[{ label: 'Placed', state: 'done' }, { label: 'Approval', state: 'current' }, { label: 'Dispatch', state: 'upcoming' }]} />
        </G>
        <G set="Tracker" v="Stage=Rejected" wide>
          <Tracker steps={[{ label: 'Placed', state: 'done' }, { label: 'Rejected', state: 'failed' }, { label: 'Dispatch', state: 'upcoming' }]} />
        </G>
        <G set="Receipt" v="Kind=Order" wide>
          <Receipt rows={[{ label: 'Subtotal', value: '₹25,000', formula: '250 kg × ₹100' }, { label: 'Delivery', value: '₹100' }, { label: 'Total', value: '₹25,100', total: true }]} />
        </G>
        <G set="Timeline" v="Kind=Order" wide>
          <FjTimeline items={[{ title: 'Order placed', meta: 'Yesterday, 6:20 PM', state: 'done' }, { title: 'Waiting for approval', meta: 'Usually within 2 days', state: 'current' }, { title: 'Dispatch', state: 'upcoming' }]} />
        </G>
      </Section>
      <Section title="Cards">
        <G set="Cover story" v="Kind=News" wide>
          <CoverStory item={news[0]} bleed={false} />
        </G>
        <G set="Story row" v="Flip=No" wide>
          <StoryRow item={news[1]} />
        </G>
        <G set="Story row" v="Flip=Yes" wide>
          <StoryRow item={news[2]} flip />
        </G>
        <G set="Index story" v="Kind=Default" wide>
          <IndexStory item={news[3]} index={1} />
        </G>
        <G set="Video tile" v="Kind=Default" w={300}>
          <VideoTile item={videos[0]} width={300} />
        </G>
        <G set="Guide card" v="Kind=Default" w={220}>
          <GuideCard item={articles[0]} />
        </G>
        <G set="Event poster" v="Kind=Default" wide>
          <EventPoster event={events[0]} />
        </G>
        <G set="Event line" v="Kind=Default" wide>
          <EventLine event={events[1]} />
        </G>
        {(['pending', 'approved', 'rejected'] as const).map((st) => (
          <G key={st} set="Order ticket" v={`Status=${st}`} wide>
            <OrderTicket order={byStatus(orders, st)} />
          </G>
        ))}
        {(['pending', 'approved', 'rejected'] as const).map((st) => (
          <G key={st} set="Booking ticket" v={`Status=${st}`} wide>
            <BookingTicket booking={byStatus(bookings, st)} />
          </G>
        ))}
        <G set="Field tile" v="Kind=Default" w={240}>
          <FieldTile land={lands[0]} />
        </G>
      </Section>
    </div>
  );
}

const dir = new URLSearchParams(location.search).get('d') === 'd2' ? 'd2' : 'd1';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <D1Toasts>
        <D2Toasts>{dir === 'd2' ? <D2 /> : <D1 />}</D2Toasts>
      </D1Toasts>
    </MemoryRouter>
  </StrictMode>,
);
void [Share2];
