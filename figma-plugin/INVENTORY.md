# Screen, state and component inventory

Generated from the data pack captured on 2026-11-18. This is everything the plugin builds.

## 01 · Illustrated

57 screens, 176 further states and flow steps, 34 component sets (121 variants), 104 tokens, 13 text styles, 4 effect styles.

### Onboarding

| Screen | Route | States |
|---|---|---|
| Splash | `—` | Default |
| Welcome | `/welcome` | Default · Tab · Step 2 of 3 · Tab · Step 3 of 3 |
| Choose language | `/welcome/language` | Default · Option · मराठी Marathi म · Option · हिन्दी Hindi हि |
| Sign in | `/auth` | Default · Invalid phone number · After tapping · Log in · Validation · Get OTP |
| Enter code | `/auth/otp` | Code sent · Verifying · Wrong code |
| Location access | `/auth/location` | Default · After tapping · Allow location |

### Home

| Screen | Route | States |
|---|---|---|
| Home | `/home` | Default · Loading · Empty · Offline · Hindi · Location denied · Marathi · Sheet · Ask Kisani Didi · Sheet · Choose your language · Sheet · Contact Sumita · Sheet · Weather · Ratanpur, Buldhana · Unverified account |
| Notifications | `/notifications` | Default · Loading · Empty · Offline · After tapping · Bookings · After tapping · Events · After tapping · Forms · After tapping · Orders · All read · Toast · All caught up Undo |

### Learn

| Screen | Route | States |
|---|---|---|
| Learn · Journal | `/learn` | Default · Loading · Empty · Offline · Sheet · Filter news stories by date · No search results · Search results |
| Saved | `/bookmarks` | Default · No saved items · Tab · Articles 1 · Tab · Videos 1 · Toast · Removed from bookmarks Undo |
| News story · Paddy straw collection opens across Buldhana vil | `/news/n-straw-collection` | Default · Sheet · Share · Toast · Saved to bookmarks View |
| News story · Why burning stubble costs your next crop | `/news/n-stubble-cost` | Default · Loading · Offline · Sheet · Share |
| Guide · Drip irrigation for cotton: a practical start | `/articles/a-drip-cotton` | Default · Sheet · Share · Toast · Saved to bookmarks View |
| Guide · How to read your Soil Health Card | `/articles/a-soil-health-card` | Default · Loading · Offline · Sheet · Share |
| Video · Baling paddy straw: one field, start to finish | `/videos/v-baling` | Default · Loading · Offline · Sheet · Share |
| Video · Taking a soil sample the right way | `/videos/v-soil-sample` | Default · Sheet · Share · Toast · Saved to bookmarks View |

### Events

| Screen | Route | States |
|---|---|---|
| Events | `/events` | Default · Loading · Empty · Offline · After tapping · Friday, 20 November 2026, has events · After tapping · Friday, 27 November 2026, no events · After tapping · Monday, 23 November 2026, no events · After tapping · Monday, 30 November 2026, no events · After tapping · Saturday, 21 November 2026, no events · After tapping · Saturday, 28 November 2026, no events · After tapping · Sunday, 22 November 2026, no events · After tapping · Sunday, 29 November 2026, no events · After tapping · Thursday, 19 November 2026, no events · After tapping · Thursday, 26 November 2026, has events · After tapping · Tuesday, 1 December 2026, no events · After tapping · Tuesday, 24 November 2026, no events · After tapping · Wednesday, 18 November 2026, has events · After tapping · Wednesday, 25 November 2026, no events · Location denied |
| Event · Crop health awareness session | `/events/e-crop-health` | Default · Sheet · Contact Sumita · Sheet · Share · Toast · Marked as interested. See you there! · Toast · Marked as not interested |
| Event · Farmer training workshop: organic inputs | `/events/e-training` | Default · Sheet · Contact Sumita · Sheet · Share · Toast · Marked as not interested Undo |
| Event · Paddy straw baling demonstration | `/events/e-baling-demo` | Default · Loading · Offline · Sheet · Contact Sumita · Sheet · Share · Toast · Marked as interested. See you there! · Toast · Marked as not interested |

### Orders & bookings

| Screen | Route | States |
|---|---|---|
| Orders & bookings | `/orders` | Default · Loading · Empty · Offline · After tapping · Approved 2 · After tapping · Pending approval 1 · After tapping · Rejected 1 · Sheet · Orders placed between · Unverified account · Empty · No bookings |
| New FOM order | `/orders/fom/new` | Default · After tapping · 1,000 kg · After tapping · 100 kg · After tapping · 250 kg · After tapping · 500 kg · Tab · Tonnes · Unverified account · Validation · Review order · Below minimum |
| New booking | `/bookings/new` | Default · Loading · Empty · Offline · Option · Cotton Field 8 acres · Cotton · Option · Paddy Field 12 acres · Rice, Chickpea, G · Option · Wheat Field 30 acres · Wheat · Unverified account · Validation · Continue · Step 2 · Filled · Step 3 · Filled |
| Order placed · Order placed | `/orders/fom/FOM2611014/placed` | Default · Loading · Offline |
| FOM order · Order #FOM2610003 | `/orders/fom/FOM2610003` | Default · Sheet · Contact Sumita |
| FOM order · Order #FOM2610021 | `/orders/fom/FOM2610021` | Default · Sheet · Contact Sumita |
| FOM order · Order #FOM2611009 | `/orders/fom/FOM2611009` | Default · Sheet · Contact Sumita |
| FOM order · Order #FOM2611014 | `/orders/fom/FOM2611014` | Default · Loading · Offline · Sheet · Contact Sumita |
| Booking requested · Booking requested | `/bookings/4581/requested` | Default · Loading · Offline |
| Booking · Booking #4581 | `/bookings/4581` | Default · Loading · Empty · Offline · Sheet · Contact Sumita |
| Booking · Booking #4589 | `/bookings/4589` | Default · Sheet · Contact Sumita |
| Booking · Booking #5848 | `/bookings/5848` | Default · Sheet · Contact Sumita |
| Booking · Booking #8458 | `/bookings/8458` | Default · Sheet · Contact Arpit · Sheet · Contact Sumita |

### Season records

| Screen | Route | States |
|---|---|---|
| Season records | `/forms` | Default · Loading · Empty · Offline · After tapping · Completed 1 · After tapping · In progress 1 |
| Season step · Intercultivation | `/forms/fc-cotton/steps/intercultivation` | Default · Loading · Offline · After tapping · Visit 1 Saturday, 19 September 2026 · After tapping · Visit 2 Wednesday, 14 October 2026 |
| Season step · Land preparation | `/forms/fc-cotton/steps/land-preparation` | Default |
| Season step · Sowing & transplantation | `/forms/fc-cotton/steps/sowing` | Default |
| Season record · Form cycle #1 | `/forms/fc-wheat` | Default · Sheet · Contact Sumita |
| Season record · Form cycle #2 | `/forms/fc-cotton` | Default · Loading · Offline · Sheet · Contact Sumita |

### Fields

| Screen | Route | States |
|---|---|---|
| My fields | `/lands` | Default · Loading · Empty · Offline |
| Add a field | `/lands/new` | Default · Validation · Continue · Step 1 · Filled · Step 2 · Filled · Step 3 · Filled · Submitted |
| Field · Cotton Field | `/lands/l-cotton` | Default · Sheet · Add a crop · Sheet · Edit crop · Sheet · Edit field |
| Field · Paddy Field | `/lands/l-paddy` | Default · Sheet · Add a crop · Sheet · Edit crop · Sheet · Edit field |
| Field · Riverside Plot | `/lands/l-riverside` | Default · Sheet · Add a crop · Sheet · Edit field · Toast · Riverside Plot is active Undo |
| Field · Wheat Field | `/lands/l-wheat` | Default · Sheet · Add a crop · Sheet · Edit crop · Sheet · Edit field |

### Account

| Screen | Route | States |
|---|---|---|
| Account | `/account` | Default · Sheet · Log out? · Unverified account |
| Profile | `/account/profile` | Default |
| Language | `/account/language` | Default |
| Password | `/account/password` | Default · Validation · Change password |
| Machinery | `/account/machinery` | Default · After tapping · Fewer Tractor · After tapping · More Tractor · After tapping · Tractor 1 owned · After tapping · Trolley 1 owned |
| Help | `/account/help` | Default |
| Contact us | `/account/contact` | Default · Sheet · Contact Kisani · Sheet · Contact Sumita |
| About | `/account/about` | Default |
| Privacy policy | `/account/legal/privacy` | Default |
| Terms of use | `/account/legal/terms` | Default |
| Verify account | `/account/verify` | Default |
| Prototype controls | `/account/prototype` | Default · Sheet · Reset prototype data? |

### System

| Screen | Route | States |
|---|---|---|
| Design system | `/design-system` | Default |
| Not found | `/this-page-does-not-exist` | Default |

### Components

| Component set | Variants |
|---|---|
| Button | Variant=primary, Size=lg, State=Default · Variant=primary, Size=md, State=Default · Variant=primary, Size=sm, State=Default · Variant=accent, Size=lg, State=Default · Variant=accent, Size=md, State=Default · Variant=accent, Size=sm, State=Default · Variant=secondary, Size=lg, State=Default · Variant=secondary, Size=md, State=Default · Variant=secondary, Size=sm, State=Default · Variant=tonal, Size=lg, State=Default · Variant=tonal, Size=md, State=Default · Variant=tonal, Size=sm, State=Default · Variant=ghost, Size=lg, State=Default · Variant=ghost, Size=md, State=Default · Variant=ghost, Size=sm, State=Default · Variant=danger, Size=lg, State=Default · Variant=danger, Size=md, State=Default · Variant=danger, Size=sm, State=Default · Variant=primary, Size=md, State=Disabled · Variant=accent, Size=md, State=Disabled · Variant=secondary, Size=md, State=Disabled · Variant=tonal, Size=md, State=Disabled · Variant=ghost, Size=md, State=Disabled · Variant=danger, Size=md, State=Disabled · Variant=primary, Size=md, State=Loading · Variant=accent, Size=md, State=Loading · Variant=secondary, Size=md, State=Loading · Variant=tonal, Size=md, State=Loading · Variant=ghost, Size=md, State=Loading · Variant=danger, Size=md, State=Loading · Variant=glass, Size=md, State=Default |
| Button block | Variant=primary · Variant=secondary |
| Icon button | Variant=surface, Size=lg · Variant=surface, Size=md · Variant=surface, Size=sm · Variant=plain, Size=lg · Variant=plain, Size=md · Variant=plain, Size=sm · Variant=tonal, Size=lg · Variant=tonal, Size=md · Variant=tonal, Size=sm · Variant=glass, Size=lg · Variant=glass, Size=md · Variant=glass, Size=sm · Variant=onImage, Size=lg · Variant=onImage, Size=md · Variant=onImage, Size=sm |
| Chip | State=Default, Count=No · State=Selected, Count=No · State=Default, Count=Yes · State=Selected, Count=Yes |
| Segmented control | Selected=First · Selected=Last |
| Switch | State=On · State=Off |
| Progress ring | Value=Partial · Value=Complete |
| Progress bar | Value=Partial |
| Stepper | Step=2 |
| Text field | State=Empty · State=Filled · State=Error · State=Hint · State=Disabled |
| Text area | State=Filled |
| Select field | State=Placeholder · State=Selected |
| Search field | State=Empty · State=Filtered |
| Status badge | Tone=success · Tone=warning · Tone=danger · Tone=info · Tone=neutral · Tone=live |
| Callout | Tone=success · Tone=warning · Tone=danger · Tone=info · Tone=neutral |
| Stale banner | Reason=Offline |
| Empty state | Illustration=emptyBox · Illustration=calendar · Illustration=search · Illustration=bell · Illustration=bookmark · Illustration=forms · Illustration=sprout · Illustration=pin · Illustration=offline · Illustration=success |
| Error state | Reason=Offline · Reason=Server |
| Skeleton | Kind=Rows · Kind=Cards · Kind=Line |
| Avatar | Verified=Yes · Verified=No |
| Section header | Action=Yes |
| List group | Kind=Default |
| Detail grid | Kind=Default |
| Timeline | Kind=Order |
| Feature card | Kind=News |
| Media row | Kind=Article · Kind=Video |
| Compact card | Tall=No · Tall=Yes |
| Date tile | Glass=No |
| Event card | Featured=Yes · Featured=No |
| Event row | Kind=Default |
| Land card | Wide=No · Wide=Yes |
| Add land card | Kind=Default |
| Order card | Status=pending · Status=approved · Status=rejected |
| Booking card | Status=pending · Status=approved · Status=rejected |

## 02 · Field Journal

58 screens, 189 further states and flow steps, 36 component sets (108 variants), 67 tokens, 13 text styles, 3 effect styles.

### Onboarding

| Screen | Route | States |
|---|---|---|
| Splash | `—` | Default |
| Welcome | `/d2/welcome` | Default · Tab · Page 2 of 3 · Tab · Page 3 of 3 |
| Choose language | `/d2/welcome/language` | Default · Option · म MARATHI मराठी · Option · हि HINDI हिन्दी |
| Sign in | `/d2/auth` | Default · Invalid phone number · Tab · Log in · Validation · Send me a code |
| Enter code | `/d2/auth/otp` | Code sent · Verifying · Wrong code |
| Location access | `/d2/auth/location` | Default · After tapping · Allow location |

### Home

| Screen | Route | States |
|---|---|---|
| Home | `/d2/home` | Default · Loading · Empty · Offline · Hindi · Location denied · Marathi · Sheet · Ask Kisani Didi · Sheet · Choose your language · Sheet · Contact Sumita Kumari · Sheet · Ratanpur, Buldhana · Unverified account |
| Notifications | `/d2/notifications` | Default · Loading · Empty · Offline · After tapping · Bookings · After tapping · Events · After tapping · Orders · After tapping · Records · All read · Toast · All caught up Undo |

### Learn

| Screen | Route | States |
|---|---|---|
| Learn · Journal | `/d2/learn` | Default · Loading · Empty · Offline · Sheet · News stories published between |
| Search | `/d2/search` | Default · No search results · After tapping · Crop care · After tapping · drip · After tapping · fom · After tapping · Machinery · After tapping · Market & storage · After tapping · soil · After tapping · spray · After tapping · straw · After tapping · Weather · After tapping · wheat |
| Saved | `/d2/bookmarks` | Default · No saved items · Tab · Articles 1 · Tab · Videos 1 · Toast · Removed from bookmarks Undo |
| News story · Paddy straw collection opens across Buldhana vil | `/d2/news/n-straw-collection` | Default · Sheet · Paddy straw collection opens across Buld · Toast · Saved to bookmarks View |
| News story · Why burning stubble costs your next crop | `/d2/news/n-stubble-cost` | Default · Loading · Offline · Sheet · Why burning stubble costs your next crop |
| Guide · Drip irrigation for cotton: a practical start | `/d2/articles/a-drip-cotton` | Default · Sheet · Drip irrigation for cotton: a practical  · Toast · Saved to bookmarks View |
| Guide · How to read your Soil Health Card | `/d2/articles/a-soil-health-card` | Default · Loading · Offline · Sheet · How to read your Soil Health Card |
| Video · Baling paddy straw: one field, start to finish | `/d2/videos/v-baling` | Default · Loading · Offline · After tapping · Play Baling paddy straw: one field, star · After tapping · Read the notes · Sheet · Baling paddy straw: one field, start to  |
| Video · Taking a soil sample the right way | `/d2/videos/v-soil-sample` | Default · After tapping · Play Taking a soil sample the right way · After tapping · Read the notes · Sheet · Taking a soil sample the right way · Toast · Saved to bookmarks View |

### Events

| Screen | Route | States |
|---|---|---|
| Events | `/d2/events` | Default · Loading · Empty · Offline · After tapping · Friday, 20 November 2026, has events · After tapping · Friday, 27 November 2026, no events · After tapping · Monday, 23 November 2026, no events · After tapping · Monday, 30 November 2026, no events · After tapping · Saturday, 21 November 2026, no events · After tapping · Saturday, 28 November 2026, no events · After tapping · Sunday, 22 November 2026, no events · After tapping · Sunday, 29 November 2026, no events · After tapping · Thursday, 19 November 2026, no events · After tapping · Thursday, 26 November 2026, has events · After tapping · Tuesday, 1 December 2026, no events · After tapping · Tuesday, 24 November 2026, no events · After tapping · Wednesday, 18 November 2026, has events · After tapping · Wednesday, 25 November 2026, no events · Location denied |
| Event · Crop health awareness session | `/d2/events/e-crop-health` | Default · Loading · Offline · Sheet · Contact Sumita Kumari · Sheet · Crop health awareness session · Toast · Marked as interested. See you there! · Toast · Marked as not interested |
| Event · Farmer training workshop: organic inputs | `/d2/events/e-training` | Default · Sheet · Contact Sumita Kumari · Sheet · Farmer training workshop: organic inputs · Toast · Marked as not interested Undo |
| Event · Paddy straw baling demonstration | `/d2/events/e-baling-demo` | Default · Sheet · Contact Sumita Kumari · Sheet · Paddy straw baling demonstration · Toast · Marked as interested. See you there! · Toast · Marked as not interested |

### Orders & bookings

| Screen | Route | States |
|---|---|---|
| Orders & bookings | `/d2/orders` | Default · Loading · Empty · Empty · No bookings · Offline · After tapping · 1 Pending · After tapping · 1 Rejected · After tapping · 2 Approved · Sheet · Orders placed between · Unverified account |
| New FOM order | `/d2/orders/fom/new` | Default · Below minimum · After tapping · 1,000 kg · After tapping · 100 kg · After tapping · 250 kg · After tapping · 500 kg · After tapping · More, by 50 kg · Option · Tonnes · Unverified account · Validation · Review |
| New booking | `/d2/bookings/new` | Default · Step 2 · Filled · Step 3 · Filled · Loading · Empty · Offline · Option · Cotton Field 8 acres · Cotton · Option · Paddy Field 12 acres · Rice, Chickpea, G · Option · Wheat Field 30 acres · Wheat · Unverified account · Validation · Continue |
| Order placed · Order placed | `/d2/orders/fom/FOM2611014/placed` | Default · Loading · Offline |
| FOM order · Order #FOM2610003 | `/d2/orders/fom/FOM2610003` | Default · Sheet · Contact Sumita Kumari |
| FOM order · Order #FOM2610021 | `/d2/orders/fom/FOM2610021` | Default · Sheet · Contact Sumita Kumari |
| FOM order · Order #FOM2611009 | `/d2/orders/fom/FOM2611009` | Default · Sheet · Contact Sumita Kumari |
| FOM order · Order #FOM2611014 | `/d2/orders/fom/FOM2611014` | Default · Loading · Offline · Sheet · Contact Sumita Kumari |
| Booking requested · Request sent | `/d2/bookings/4581/requested` | Default · Loading · Offline |
| Booking · Booking #4581 | `/d2/bookings/4581` | Default · Loading · Offline · Sheet · Contact Sumita Kumari |
| Booking · Booking #4589 | `/d2/bookings/4589` | Default · Sheet · Contact Sumita Kumari |
| Booking · Booking #5848 | `/d2/bookings/5848` | Default · Sheet · Contact Sumita Kumari |
| Booking · Booking #8458 | `/d2/bookings/8458` | Default · Sheet · Contact Arpit Verma · Sheet · Contact Sumita Kumari |

### Season records

| Screen | Route | States |
|---|---|---|
| Season records | `/d2/forms` | Default · Empty · Offline · After tapping · Completed 1 · After tapping · In progress 1 |
| Season step · Intercultivation | `/d2/forms/fc-cotton/steps/intercultivation` | Default · After tapping · Visit 1 Saturday, 19 September 2026 · After tapping · Visit 2 Wednesday, 14 October 2026 |
| Season step · Land preparation | `/d2/forms/fc-cotton/steps/land-preparation` | Default · Loading · Offline |
| Season step · Sowing & transplantation | `/d2/forms/fc-cotton/steps/sowing` | Default |
| Season record · Form cycle #1 | `/d2/forms/fc-wheat` | Default · Sheet · Contact Sumita Kumari |
| Season record · Form cycle #2 | `/d2/forms/fc-cotton` | Default · Loading · Offline · Sheet · Contact Sumita Kumari |

### Fields

| Screen | Route | States |
|---|---|---|
| My fields | `/d2/lands` | Default · Loading · Empty · Offline |
| Add a field | `/d2/lands/new` | Default · Step 1 · Filled · Step 2 · Filled · Step 3 · Filled · Validation · Continue |
| Field · Cotton Field | `/d2/lands/l-cotton` | Default · Sheet · Add a crop · Sheet · Cotton Field · Sheet · Edit Cotton |
| Field · Paddy Field | `/d2/lands/l-paddy` | Default · Sheet · Add a crop · Sheet · Edit Chickpea (gram) · Sheet · Edit Green gram (moong) · Sheet · Edit Rice · Sheet · Paddy Field |
| Field · Riverside Plot | `/d2/lands/l-riverside` | Default · Sheet · Add a crop · Sheet · Riverside Plot · Toast · Riverside Plot is active Undo |
| Field · Wheat Field | `/d2/lands/l-wheat` | Default · Sheet · Add a crop · Sheet · Edit Wheat · Sheet · Wheat Field |

### Account

| Screen | Route | States |
|---|---|---|
| Account | `/d2/account` | Default · Sheet · Log out? · Unverified account |
| Profile | `/d2/account/profile` | Default |
| Language | `/d2/account/language` | Default |
| Password | `/d2/account/password` | Default · Validation · Change password |
| Machinery | `/d2/account/machinery` | Default · After tapping · Fewer Tractor · After tapping · More Tractor · After tapping · Tractor 1 owned · After tapping · Trolley 1 owned |
| Help | `/d2/account/help` | Default |
| Contact us | `/d2/account/contact` | Default · Sheet · Contact Kisani Urjaa support · Sheet · Contact Sumita Kumari |
| About | `/d2/account/about` | Default |
| Privacy policy | `/d2/account/legal/privacy` | Default |
| Terms of use | `/d2/account/legal/terms` | Default |
| Verify account | `/d2/account/verify` | Default |
| Prototype controls | `/d2/account/prototype` | Default · Sheet · Reset prototype data? |

### System

| Screen | Route | States |
|---|---|---|
| Design system | `/d2/design-system` | Default |
| Not found | `/d2/this-page-does-not-exist` | Default |

### Components

| Component set | Variants |
|---|---|
| Button | Variant=primary, Size=lg, State=Default · Variant=primary, Size=md, State=Default · Variant=primary, Size=sm, State=Default · Variant=secondary, Size=lg, State=Default · Variant=secondary, Size=md, State=Default · Variant=secondary, Size=sm, State=Default · Variant=tonal, Size=lg, State=Default · Variant=tonal, Size=md, State=Default · Variant=tonal, Size=sm, State=Default · Variant=ghost, Size=lg, State=Default · Variant=ghost, Size=md, State=Default · Variant=ghost, Size=sm, State=Default · Variant=danger, Size=lg, State=Default · Variant=danger, Size=md, State=Default · Variant=danger, Size=sm, State=Default · Variant=primary, Size=md, State=Disabled · Variant=secondary, Size=md, State=Disabled · Variant=tonal, Size=md, State=Disabled · Variant=ghost, Size=md, State=Disabled · Variant=danger, Size=md, State=Disabled · Variant=primary, Size=md, State=Loading · Variant=secondary, Size=md, State=Loading · Variant=tonal, Size=md, State=Loading · Variant=ghost, Size=md, State=Loading · Variant=danger, Size=md, State=Loading · Variant=accent, Size=md, State=Default · Variant=glass, Size=md, State=Default |
| Button block | Variant=primary |
| Icon button | Variant=surface, Badge=No · Variant=plain, Badge=No · Variant=night, Badge=No · Variant=glass, Badge=No · Variant=surface, Badge=Yes · Variant=surface, Badge=No, Active=Yes |
| Chip | State=Default, Count=No · State=Selected, Count=No · State=Selected, Count=Yes · State=Default, Count=Yes |
| Section tabs | Size=lg · Size=md |
| Toggle | Selected=First · Selected=Second |
| Switch | State=On · State=Off |
| Counter | Value=Some · Value=Zero |
| Text field | State=Empty · State=Filled · State=Error · State=Hint · State=Disabled |
| Text area | State=Filled |
| Select field | State=Placeholder · State=Selected |
| Search box | State=Empty · State=Filtered |
| Status tag | Tone=success · Tone=warning · Tone=danger · Tone=info · Tone=live · Tone=neutral |
| Note | Tone=success · Tone=warning · Tone=danger · Tone=info · Tone=neutral |
| Stale note | Reason=Offline |
| Loading | Kind=Default |
| Empty state | Illustration=crate · Illustration=calendar · Illustration=search · Illustration=bell · Illustration=bookmark · Illustration=records · Illustration=sprout · Illustration=pin · Illustration=offline · Illustration=weather · Illustration=success |
| Error state | Reason=Offline · Reason=Server |
| Skeleton | Kind=List · Kind=Line |
| Avatar | Verified=Yes · Verified=No |
| Section head | Action=Yes |
| Row group | Kind=Default |
| Segments | Progress=3 of 8 |
| Tracker | Stage=Approval · Stage=Rejected |
| Receipt | Kind=Order |
| Timeline | Kind=Order |
| Cover story | Kind=News |
| Story row | Flip=No · Flip=Yes |
| Index story | Kind=Default |
| Video tile | Kind=Default |
| Guide card | Kind=Default |
| Event poster | Kind=Default |
| Event line | Kind=Default |
| Order ticket | Status=pending · Status=approved · Status=rejected |
| Booking ticket | Status=pending · Status=approved · Status=rejected |
| Field tile | Kind=Default |

