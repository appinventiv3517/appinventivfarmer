# Kisani Didi App: what was kept, removed and added

The Kisani Didi App is a separate app in the same repository (`src/didi`, opened at `/#/didi`).
It reuses Ver 3's design system and leaves the Farmer App (`src/d3`) untouched.

## Kept from the Farmer App (Ver 3)

| Area | What is reused | How |
| --- | --- | --- |
| Tokens | Colours, type scale, spacing, radii, shadows, photo grade (`--fj3-*`) | `src/d3/styles/tokens.css` and `base.css` imported as they are |
| Components | Toggle, Chips, SectionTabs, Switch, Counter, TextField, TextArea, Sheet and dialog, Toast, SearchBox, BackButton, Photo, Lottie states | Imported from `src/d3` |
| Path-aware components | Button, IconButton, Row, SectionHead, EmptyState, ErrorState, Skeletons, Screen | Copied into `src/didi/ui` and `src/didi/layout` with `/didi` paths. They still use the Ver 3 CSS modules, so they look the same |
| Motion | Page rise and recede, tab cross-fade, `SWAP`, `stepMotion`, springs, `Cascade` and `Rise` reveals | Same tokens and variants |
| Splash | The same logo, loading bar and ivory glow | Footer reads "For Kisani Didis across India" |
| Onboarding | The full-screen photo welcome, language step, log-in frame, OTP boxes, password fields | Copy rewritten for the Didi role |
| Navigation | The floating dock: same pill, glyph style and selection | Five tabs |
| Hero | The Home photo hero with greeting and dateline, plus a card overlapping it | Attendance replaces the weather card |
| Weather | Live Open-Meteo weather with a labelled sample fallback and the spray advice | Shown as a farming tip for her farmers |

## Removed or not carried over

- **Farmer journeys:** Order FOM, Book a service, Requests, season records (forms), Add a field, Learn (news, videos, guides), Events, Machinery, Ask Didi voice.
- **Sign-up:** Kisani Didis are set up by Kisani Urjaa, so they only log in (Partner ID and password, or mobile OTP) and can reset the password. There is no account creation or three-step profile setup.
- **The centre New key in the dock:** a Didi's quick actions (attendance, her QR code) sit on Home instead.
- **Scanning farmer QR codes:** removed on request. The Didi shows her own QR code instead.
- **Desktop direction switcher:** the Kisani Didi build bundles only this app.

## Added for the Kisani Didi role

| Module | Screens and states |
| --- | --- |
| Home | Greeting by time of day, name, date, notifications with unread count, language switch (replaces the profile initials; Profile stays in the dock). Attendance card with Check in and Check out. My QR code. Tasks overview (pending, in progress, in review) with a "needs your action" alert. Farmers preview with the not-verified count. Bookings: count awaiting a decision and the latest update. Weather and tip. Transactions summary. Leaderboard (mandal, state or national) |
| My Tasks | Pending, In progress and Closed tabs, with a filter sheet (status within the tab, due-date range). Statuses: Pending, In progress, In review, Approved, Rejected, Resubmitted, Lapsed. Cards: title, status, progress, assigned and due dates, completed or submitted date. Details: description, assigned and due dates, progress %, target completed of total, score, note from Kisani Urjaa, rejection feedback. Actions follow the status (`actionsFor`): Pending → Start task (with confirmation); In progress → Add progress; Rejected → Resubmit; others are view only. Add progress: target counter with live %, notes, photos, videos and documents with previews and remove, Save progress, Submit for approval with confirmation and success. Progress details: every update with date, count, files, approval or rejection, rejection reason and admin remarks; Add more progress or Resubmit. Demo builds can approve or reject a task in review from its screen (marked Prototype only) |
| Farmers | Search by name, ID, village or phone. Filter sheet: verification, profile status, geo-tag, village, registered date range. Verified farmers carry a green badge; others a muted card and a status tag (Not verified, Verification pending, Verification failed). Verify farmer: ID details, document photos (front, back, farmer with document) with previews and remove, review with a confirmation, then pending; failed shows the reason and Verify again. Demo builds can decide a pending verification from the farmer screen. Cards with ID, phone, village and completion ring. Details in Overview, Land & crops and Address tabs: completion steps, personal details, active crops, land with a geo-tag outline and coordinates, full address. Loading, empty, error and not-found states |
| Attendance | Live clock. Check in and out with location capture, or a "no location" path. Worked hours. Month calendar marking present, absent, off and today, with day details and two months of history. Monthly stats. Recent days |
| My QR code | The Didi's own QR code (holds `kisaniurjaa:didi:<Partner ID>`), name, cluster and Partner ID, shown large to be scanned. Drawn by a small built-in encoder (`src/didi/lib/qr.ts`), no extra package |
| Check in / Check out | A selfie (front camera) and the phone's location are both required before confirming, and are saved with the day's record. If location is off: Try again; the demo build also offers a clearly labelled sample location |
| Transactions | Totals for the chosen range. Filters by range and status. List and detail with reference copy and a link to support |
| Leaderboard | Mandal (her own, Buldhana), State (Maharashtra) or National, and This month or All time. Sample ranks stand in for Kisani Urjaa records. Podium for the top three. Her own row highlighted, or pinned below the list when she isn't in it |
| Bookings | Straw clearing (baler) bookings for the cluster's farmers, same model as the Farmer App. Search by booking number or farmer, status chips, filter sheet (status, visit-date range). Statuses: Awaiting approval, Booking approved, Booking rejected, Cancellation requested, Cancellation approved, Completed. Details: status tracker, rejection or cancellation reason, Kisani Urjaa remarks, booking facts, operator, farmer card with verification and call. Entry points: Home, Profile → My work, notifications, farmer details |
| Notifications | Categories: new task, deadline, review, farmers, bookings (with the booking number, opening the booking), attendance, payments, announcements. Read and unread, mark all read, filters, and tapping opens the related screen |
| Profile | Profile card with verification status and completion. My Profile (view, edit, photo). Verification in three steps (document scan or upload, details, review), then In review and Verified. Language, password, text size, About, Privacy, Terms, FAQs, Contact, Prototype controls, Log out |

## Rules kept to

- **Business rules:** none are invented.
  - Payments, scores and ranks are shown as records from Kisani Urjaa; the app does not calculate them.
  - Location at check-in is captured when available and never blocks the Didi.
  - Proof is optional at submission; the confirmation says when none is attached.
  - Privacy and Terms are marked as placeholder summaries.
- **Sample data:** dated relative to today, so the prototype always looks current. It is shared with the Farmer App story:
  - The Didi is Sumita Kumari (KD00001), the same Kisani Didi the Farmer App shows.
  - Ram Prasad Yadav, the Farmer App's sample farmer, is one of her farmers.
- **Language:** the Didi app is English only for now. Language choice is saved, and Hindi and Marathi need native-speaker review before they are added.
- **Demo login:** Partner ID `KD00001`, password `didi1234`, or mobile `90000 00001` with OTP `123456`.
