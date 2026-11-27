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
- **The centre New key in the dock:** a Didi's main action is scanning, which sits on Home as one strong entry point.
- **Desktop direction switcher:** the Kisani Didi build bundles only this app.

## Added for the Kisani Didi role

| Module | Screens and states |
| --- | --- |
| Home | Greeting by time of day, name, photo or initials, date, notifications with unread count. Attendance card with Check in and Check out. Scan QR. Tasks overview with a "needs your action" alert. Farmers preview. Weather and tip. Transactions summary. Leaderboard (state or national) |
| My Tasks | New, Ongoing and Closed tabs. Statuses: Pending, In progress, In review, Approved, Rejected, Lapsed. Details: target and completed counter, notes, photo, video and file proof, save progress, submit with confirmation, resubmit after rejection. History: submissions, proofs (tap to view), score, reviewer comments |
| Farmers | Search by name, ID, village or phone. Filters for profile status, geo-tag and village. Cards with ID, phone, village and completion ring. Details in Overview, Land & crops and Address tabs: completion steps, personal details, active crops, land with a geo-tag outline and coordinates, full address. Loading, empty, error and not-found states |
| Attendance | Live clock. Check in and out with location capture, or a "no location" path. Worked hours. Month calendar marking present, absent, off and today, with day details and two months of history. Monthly stats. Recent days |
| QR Scanner | Camera permission explanation. Live camera that reads QR codes where the browser supports it. Scanning frame. States: found farmer (opens profile), invalid QR, permission denied, camera error. Manual farmer ID entry. Demo scans |
| Transactions | Totals for the chosen range. Filters by range and status. List and detail with reference copy and a link to support |
| Leaderboard | Maharashtra or National, and This month or All time. Podium for the top three. Her own row highlighted, or pinned below the list when she isn't in it |
| Notifications | Categories: new task, deadline, review, farmers, attendance, payments, announcements. Read and unread, mark all read, filters, and tapping opens the related screen |
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
