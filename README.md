# ZO Hotel — stays in Mumbai and Goa

A working hotel website for the content-writing assignment on booking cancellations.
Open `index.html` in a browser. No build step, no dependencies, no network access —
everything runs from the file system.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | The hotel home page. Photography-led: hero, destinations, experience, rooms, meetings, then flexible booking as reassurance. |
| `mumbai.html` | **ZO Hotel Mumbai.** Urban and type-led: hero, location, five nearby landmarks, the restaurant and three benefits, a facade band over the rate list, trust, one flexibility note, then the booking CTA. |
| `goa.html` | **ZO Hotel Goa.** Coastal and photographic: hero, a day told in three photographs, four places along the coast, a pool band over the rate list, trust, one flexibility note, then the booking CTA. |
| `accessibility.html` | **Accessibility**, in the navigation of every page. What it costs (nothing extra), what each hotel has, what is not step-free, every room type at its own rate, and a statement about the site itself. |
| `flexible-booking.html` | **Part B in full** — the six cancellation reasons with answers, the whole policy table, the evidence, and the trust section. |
| `part-a-exit-prompt.html` | **Part A** — the exit prompt, running live, with its four required pieces of copy and the rule behind each decision. |
| `booking.html` | Booking form: live pricing, GST, full client-side validation, confirmation. |
| `manage.html` | Where the exit prompt fires. Look up a booking, change dates, add requests, cancel. |
| `style-guide.html` | The copy decisions this site commits to, with before/after against the current ZO site. |
| `tests/browser-check.html` | Open it to drive the real dialogs in your browser and see 76 behaviour checks pass. |

## Photography

The seven supplied images are used once each on the home page, never scaled beyond
their own pixels. **Filenames did not match content**, so they are assigned by what
they actually show:

| File | Actual content | Used for |
| --- | --- | --- |
| `goa-resort.jpg` (1846×1230) | Goa beach + cliffside resort, golden hour | Home hero, full bleed · Goa page hero |
| `hero-goa..jpg` (1200×943) | Grand city hotel at dusk, courtyard pool | Mumbai destination panel · Mumbai page hero and rooms band |
| `mumbai-hotel.jpg` (900×600) | Night resort pool, lit villas | Goa destination panel · Goa page rooms band |
| `pool.jpg` (1900×750) | Day poolside, palms, loungers | Experience section, exit-prompt dialog · Goa page afternoon |
| `dining.avif` (500×250) | Poolside restaurant interior | Experience accent, capped at 420px wide · Mumbai page inset and Goa page morning |
| `room-ocean.jpeg` (3413×2560) | Resort wing at dusk above a pool | Rooms band · Goa page evening |
| `room-business.jpg` (1000×1500) | Banquet hall, blue and white settings | Meetings section only |

Added later, outside the supplied seven:

| File | Actual content | Used for |
| --- | --- | --- |
| `award.png` (1010×941) | Gold statuette holding five stars, transparent ground | Recognition column of the home page trust section |

### Borrowed photography — the nearby-attraction cards

The supplied set contains no photograph of any real place, so the *Around the hotel*
sections on the two property pages use nine photographs from **Wikimedia Commons** under
CC BY or CC BY-SA. They are committed to `assets/img/` as local files at 1000px wide, so
the site still runs from the file system with no network access.

**These licences require attribution.** Each section therefore closes with a
`.nearby__credit` line naming the photographer, the licence and the source, and a test
fails the build if a `near-*.jpg` is added without one.

| File | Place | Photographer | Licence |
| --- | --- | --- | --- |
| `near-mumbai-gateway.jpg` | Gateway of India | Sharvarism | CC BY-SA 4.0 |
| `near-mumbai-marine.jpg` | Marine Drive, the Queen's Necklace at night | Ashwin Kumar | CC BY-SA 2.0 |
| `near-mumbai-csmt.jpg` | Chhatrapati Shivaji Maharaj Terminus, floodlit | Dr. Raju Kasambe | CC BY-SA 4.0 |
| `near-mumbai-colaba.jpg` | Antiques on Colaba Causeway | ghoseb (Flickr) | CC BY-SA 2.0 |
| `near-mumbai-vadapav.jpg` | Vada pav, the city's own sandwich | Rutvi Mistry | CC BY-SA 4.0 |
| `near-goa-baga.jpg` | Baga Beach | Nikhilb239 | CC BY-SA 4.0 |
| `near-goa-calangute.jpg` | Calangute Beach at sunset | Anoop M S | CC BY-SA 4.0 |
| `near-goa-aguada.jpg` | Fort Aguada bastion and lighthouse | Harvinder Chandigarh | CC BY-SA 4.0 |
| `near-goa-anjuna.jpg` | Anjuna Beach rocks | Nikhilb239 | CC BY 3.0 |

Two rules these cards keep:

- **No distance and no travel time.** The project commits to the hotel being at Marine Lines
  in South Mumbai and at Baga Beach in North Goa, and to nothing more precise, so every
  locator is relational — *the next beach south*, *Fort, just inland*. A test asserts no
  number with a unit reaches either section, and each closes by saying the front desk gives
  the real answer.
- **The hotel is fictional; the places are not.** The credit line says so, so a reader never
  takes a real photograph as evidence that ZO Hotel exists.

Two notes worth keeping:

- **`hero-goa..jpg` has two dots.** Any reference to `hero-goa.jpg` fails silently in a
  browser. A test asserts every referenced image exists on disk.
- `room-business.jpg` shows another hotel's logo on a projector screen, so it is framed
  with `object-position: center 82%` to keep that out of shot. It is a banquet hall, not a
  bedroom, so it sells meetings rather than a room. **That framing is proportion-dependent
  and does not travel**: the section it sits in on the home page is short enough to crop
  the screen away, and a taller section reveals it. It is therefore used on the home page
  only, and the Mumbai page uses the restaurant instead.
- No supplied photograph shows a guest room. Rooms are therefore a photographic band plus
  an editorial rate list, rather than four cards with imagery that would be a lie. On the
  two property pages the same list gains a *View room* disclosure, so a guest compares
  written detail rather than a stand-in photograph.
- **The property pages reuse the photography, because there is no more of it.** Only
  `hero-goa..jpg` shows a city hotel, so the Mumbai page shows it twice — wide across the
  hero, then cropped to a letterbox of the lit guest-room windows over the rooms section.
  Both crops are of the same building, which is the one the page is about.
- **`award.png` is mostly empty.** The statuette sits in `x 409–599, y 0–588` of a
  1010×941 canvas; below it the file carries two decorative rules and some white lettering
  that would ghost on a warm background. Shown whole it would shrink to a thumbnail inside
  its own whitespace, so `.award__frame` is a clipping window onto `x 369–639, y 0–596`.
  The file is still displayed at its own proportions — `height: auto`, never stretched —
  and only the empty margins are cropped.

### Brand assets

The supplied artwork was a 6336×2688 render on a flat white ground. Three assets are
derived from that one file, and the derivation is worth recording because the obvious
approach breaks it.

| File | Size | Where |
| --- | --- | --- |
| `zo-logo-mark.webp` | 480×255, 18KB | Header on all eight pages, and the footer brand |
| `zo-logo-emblem.webp` | 900×843, 108KB | The brand band on `index.html` |
| `zo-favicon.png` | 64×64, 6KB | Favicon, replacing the inline SVG |

- **Keying the background needed a flood fill, not a threshold.** The letters **Z** and
  **O** are white, and the palest gold is close enough to white that an alpha-from-
  distance-to-white pass would have ghosted the crest and punched holes through both
  letters. So background is whatever white is *connected to the border*: a fill inward
  from the edges, with a short alpha ramp at the boundary so the palm fronds do not come
  out jagged. 278,696 white pixels survive inside the artwork — those are the letters.
- **The header gets the tiles only.** At the 34px the brand slot allows, the crest and its
  filigree turn to noise while two saturated squares carrying a Z and an O still read. The
  tiles are found by hue with a row projection, since the gold has dark rims that fool a
  plain luminance test.
- **WebP, because PNG could not carry it.** Canvas PNG put the header mark at 510KB — these
  are marbled textures and PNG handles them badly. WebP keeps the alpha channel at 18KB.
  The favicon stays PNG for the widest support.
- **The wordmark is typeset, not baked in.** The supplied lockup read `ZO HOTEL & & RESORT`
  — a doubled ampersand, the usual way generated type fails. The band sets *ZO Hotel &
  Resort* and *Elegance unveiled* in the site's own serif instead, so the ampersand is ours,
  it stays crisp at every width, and it is editable. A test asserts no doubled ampersand
  reaches the page.
- **The header and footer marks are decorative.** `alt=""`, because the wordmark beside them
  already names the brand and a described image would announce it twice. A test allows an
  empty alt *only* on those two classes, so an accidental empty alt on a content image is a
  failure rather than a silent omission.

## What works, not just what renders

- **Two paths out of the home page.** A destination panel is discovery, so *Explore Mumbai*
  and *Explore Goa* open `mumbai.html` and `goa.html`; only an explicit booking CTA opens
  `booking.html`. Each property page then walks one journey — discover, location,
  experience, compare rooms, trust, book — and carries a final booking CTA so nobody
  scrolls back up for it. The navigation entries named *Mumbai* and *Goa* point at the same
  two pages on every page of the site.
- **Around the hotel** — the *understand the location* step of that journey, four real places
  per property with photographs, credited, and located relative to the hotel rather than by a
  distance nobody has measured. This is what a guest searching "places to visit in Mumbai"
  actually wants from a hotel page, and it is the reason the location is worth paying for.
- **Property prefill** — every booking CTA on a property page carries `?property=mumbai` or
  `?property=goa`, and each room row adds `&room=…`, so the form opens on the hotel and the
  room the guest was reading about. `applyQueryParams` in `booking.js` already validated
  both against the rate card, so an unknown value falls back to the existing default and
  `booking.html` on its own is unchanged.
- **Whoever you bring** (`index.html#everyone`) — three travelling parties, and the point of
  putting them together is that they overlap more than hotel websites admit: a lower floor
  near the lift helps an eighty-year-old and a wheelchair user for the same reason. So
  *Room on a lower floor* is one shared request rather than two filed under separate labels.
  Every offer named is either an existing fact of the hotel — the Family room sleeps four,
  pools 6:00 am to 9:00 pm, breakfast until 11:00, early check-in from 9:00 am, ₹900 a night
  for a cot — or a request in `L.REQUESTS`. A test checks the numbers against the rate card,
  so the cards cannot drift away from what the booking form charges.
- **Pictograms, not photographs, in those two sections.** Both were asked for images and
  neither got one, for a reason worth recording. All seven supplied photographs are already
  on `index.html` once each, so a second use would read as repetition. Wikimedia Commons
  holds nothing usable: every hotel-looking result is a competitor's branded property —
  Sofitel, Marriott, Cala Millor — and the brand-free accessibility imagery is transport
  infrastructure or a military medical wing, which would read as a hospital rather than a
  hotel. Beyond availability, a pictogram is the convention for facility information anyway:
  a guest scanning for *is there a roll-in shower* reads a symbol faster than a photograph of
  somebody else's bathroom, and disability stock photography tends to show a model rather
  than the bathroom. Seven original inline SVGs in the site's existing icon language, checked
  at 30px — three were redrawn after the first pass, because a staircase, a shower and a
  wheel all failed to read at that size.
- **Accessible stays** (`index.html#accessibility`) — named facilities rather than the word
  "friendly", because a guest cannot plan around an adjective: step-free entrance, lifts to
  every floor, accessible parking, wider doorways, grab rails, a roll-in shower with a seat.
  The section tells a guest to add an accessible room to their booking, so *Accessible room*
  is a real request in `L.REQUESTS` — listed first, so it leads every UI built from that
  object, and so nobody has to telephone while everyone else books online. It closes by
  saying no checklist covers everybody and offering a number to call, which is the honest
  part. A test fails if the copy promises a control the form does not offer. Like the rest of
  this fictional hotel the facilities are invented; the mechanism to request them is not.
- **What is not step-free** — the part most hotel sites leave out, and the reason the
  accessibility section is worth having. Two named gaps and one absent facility: the stepped
  path to the Goa garden villas, the shallow step at the Mumbai pool gate, and no pool hoist
  at either hotel. A guest who meets a step on arrival has been failed twice, once by the
  building and once by the page that did not mention it. A test asserts the disclosure is
  still there and that no blanket "fully accessible" claim has crept in beside it, because
  the tidying-away of an inconvenient paragraph is exactly the kind of edit that looks like
  an improvement.
- **Best rate guarantee** (`index.html#best-rate`) — every term is one the product already
  honours. The price-match dialog in `flows.js` takes a public link, matches the rate and
  takes another 10% off, checked within one business day, within 24 hours of booking. A test
  asserts each term appears both on the page and in the flow, so the section cannot drift
  into a badge that promises more than the product does, and it refuses superlatives like
  "guaranteed lowest" that nothing could back.
- **Exit prompt** (Part A) — fires on *Cancel booking*, offers a date change first, keeps
  cancelling available as a quiet action.
- **Cancellation flow** — exit prompt → reason step → confirmation. Picking a reason changes
  the counter-offer. Non-refundable bookings must type CANCEL to proceed.
- **Date change** — live repricing, free-change countdown, sold-out detection, undo via the
  success toast.
- **Requests and price match** — both validated, both confirmed in writing.
- **Validation** — dates, guest counts, room capacity against party size, email, Indian
  mobile numbers, consent. Errors appear inline and in a summary that links to each field.
- **Trust section** (`index.html#trust`) — credibility, reliability and transparency as an
  editorial spread: the award photograph and its recognition credits on the left, the three
  pillars and a featured review on the right, then an aggregate proof strip, two supporting
  reviews, a reassurance strip and the disclosure. The recognition column is written last in
  the markup and placed left with CSS, so reading order stays heading → pillars → review →
  recognition at every width. It replaced the four-icon assurance grid that used to sit
  between flexible booking and the FAQ; `.assurances` is kept in the stylesheet for reuse.
- **Accessibility** — skip links, landmarks, focus trap and restore in every dialog, Escape
  to close, background hidden from assistive tech, visible focus, labelled controls, no
  placeholder standing in for a label, `prefers-reduced-motion` respected. Star ratings are
  glyphs marked `aria-hidden` with a "Rated 5 out of 5" text alternative beside them. The
  *View room* panels on the property pages reuse the accordion the FAQ already uses, so the
  toggle is a real button that reports `aria-expanded` and the panel is a region labelled by
  it.

### Hero type over photography

White type on a photograph only meets a contrast ratio against the pixels it actually
covers, so `.hero--property .hero__scrim` was tuned by measuring exactly that: screenshot
the hero twice, once with the type shown and once hidden, mask to the pixels the glyphs
change, and take the worst ratio in that mask. Both property heroes clear WCAG AA at 1440px
and 390px — headline 4.0–4.7:1 against the 3:1 large-text threshold, lede 4.9–6.7:1 against
4.5:1.

**The home page hero does not, and was left alone:** it measures 1.8–2.0:1 for both the
headline and the lede at either width. Raising it means a heavier scrim over
`goa-resort.jpg`, which changes how that composition reads, so it is recorded here as a
known gap rather than changed quietly. The property scrim above is the fix if it is wanted.

The measurement needs a headless browser and this project has no dependencies, so it is not
part of `tests/`. The numbers above are the record of it.

### Reproducible demo paths

- Sold-out dates: **24 Dec – 1 Jan** at either hotel, **14–16 Feb** in Goa.
- Demo booking on `manage.html`: `ZO-4193-MUM` / `guest@example.com`.
- Bookings are stored in `localStorage` for this browser only.


## Accessibility and privacy pass

Eight fixes, each with a test behind it so it cannot quietly come back.

| Fix | What was wrong |
| --- | --- |
| `.btn[hidden]` | `.btn` sets `display: inline-flex`, which outranks the UA rule for `[hidden]`. The reason step's offer button stayed on screen and stayed clickable after the script hid it, so that dialog always showed an empty third button. |
| `required` on mandatory fields | Nine controls on `booking.html` and two on `manage.html` showed a `*` and told assistive tech nothing. The rate group is a `radiogroup` with `aria-required`, named by its legend, with `required` on each radio — one group, not a radiogroup nested inside a fieldset. |
| Contrast | White on `--teal` measured **3.94:1** on the filled button, `--muted` **3.67:1** on ivory, `--sand-deep` **3.00:1** on ivory. All three are text and all three now clear 4.5:1 against white, ivory and soft white. `--sand` is unchanged because it only ever draws a rule. |
| Hero type over photography | The home headline measured **1.99:1** and its lede **1.76:1**. Both now clear AA at 1440px and 390px. On a phone `cover` scales `goa-resort.jpg` by height, so the centred slice was open sand; it is framed onto the hillside instead, which does more than a heavier scrim could. |
| No email in a URL | The confirmation handed the guest `manage.html?ref=…&email=…`, putting their address into history, the referer header and any link they pasted. The link now carries the reference alone, and `manage.js` no longer reads an address out of the query string. |
| `tests/browser-check.html` | `ZO.Flows.ART` paths are written relative to the project root, so from `tests/` the dialog photograph 404ed — and the check passed anyway, because it only looked for an `<img>` element. A `<base href="../">` fixes resolution, and the check now asserts `complete && naturalWidth > 0`, since `complete` alone is true for a 404. |
| The cancellation reason | Answering was mandatory: the step refused to continue without a selection. It is optional now, the description says so, and the quiet action reads **Skip to cancellation review** until something is chosen, then **Continue cancellation**. |
| Honest link labels | Four *View room* links on the home page opened the booking form. They read *Choose this room*. The property pages keep *View room* because there it really does open a detail panel in place. |

Coursework links and framing are off the six customer-facing pages — no *Part A*, no *Style guide*, no "content-writing assignment". `part-a-exit-prompt.html` and `style-guide.html` are unchanged and still link to each other, so the documentation stays reachable on its own. What did **not** go is the fictional-brand disclosure: the site shows invented prices, reviews and an award, and saying so is what keeps it from misleading anyone.

### The navigation drawer breakpoint

Adding *Accessibility* to the navigation surfaced a bug that predated it. Between 1000px and
1140px the horizontal list wrapped to a second row, which pushed the header from 76px to
104px while `--header-h` stayed at 76 — and since that token drives both `scroll-padding-top`
and the top padding on every `.page--solid` page, the header sat over the top of the content.
A short label only narrowed the band it happened in.

The drawer now takes over at **1140px** rather than 1000px, because a horizontal nav should
not be shown at a width it does not fit. Two numbers had to move together: the media query in
`main.css` and the `matchMedia` call in `core.js`. When only the CSS moved, the drawer
rendered open and unmanaged between the two widths — which is how the mismatch was found. A
test now reads both numbers and fails if they disagree.

*FAQ* left the navigation to make room. It was an anchor to an accordion on one page, where
Accessibility is a page; it keeps a route from the footer of all nine pages.

## Tests

```bash
node --test tests/logic.test.js      # 60 tests: pricing, refunds, validation, copy audit
open tests/browser-check.html        # 76 checks: dialogs, focus, flows, images, overflow, console
```

The copy audit is not decorative: it fails the build if any page gains an exclamation
point, a "Click here", an "Are you sure", an image without alt text or dimensions, a
missing asset, a broken internal link, or the phrase "why guests cancel".

Seven of the tests hold the information architecture and the photography licences in place,
because both fail silently in a browser: a destination panel that regresses to
`booking.html` fails, a booking CTA on a property page that drops its `property=` fails, a
room priced differently from the rate card or sold at the wrong hotel fails, a property page
that grows a second copy of the flexible-booking policy fails, a *View room* panel whose
`aria-controls` and `aria-labelledby` do not pair up fails, a borrowed photograph without a
photographer credit and a licence link fails, and a distance or travel time appearing in a
nearby section fails.

Two more hold the copy rules the style guide commits to, both of which are departures from
the Zoho UI manual and are argued as such on `style-guide.html` rather than left implicit:

- **All caps on micro-labels.** The manual rules capitals out of labels as well as titles.
  This product keeps them for labels of three words or fewer at 0.75rem — the eyebrow, the
  field label, the definition term — because that small-caps label is what holds the design
  together, and drops them where the manual's warning actually bites: **no CTA is ever
  uppercased**, which a test enforces, along with an allowlist so a new uppercase selector
  has to be added deliberately. The markup stays sentence case throughout, so a screen
  reader hears words rather than rendered capitals.
- **Periods split by copy family.** The manual's rule — no period on a single simple
  sentence — is written for microcopy. Applied to marketing prose it puts a period on one
  card in a row of three and not on its neighbours. So copy attached to a control follows
  the manual (22 of 26 strings correctly carry no period), and prose in a content section
  is punctuated as prose (25 of 25 carry one). A test keeps the prose side whole.

## Where the numbers come from

Cancellation figures on `flexible-booking.html` and `part-a-exit-prompt.html` come from the
119,390-row hotel booking dataset supplied with the assignment (37% overall cancellation
rate). The load-bearing finding is that bookings which get **changed** cancel 14% of the
time against 41% for bookings nobody touches — which is why the exit prompt offers a date
change rather than arguing with the guest.

These are **correlations, not causes**. The dataset holds structured booking signals, not
reasons a guest wrote down, so the evidence copy says *the pattern suggests* and *was
associated with* rather than claiming a change prevented a cancellation. Two distinctions the
copy keeps deliberately: the data records that a booking *carried a special request*, never
that anyone confirmed it — confirming in writing is the ZO policy response, not a measured
variable; and the six guest concerns on `flexible-booking.html` are written *from* the
patterns, not quoted from guests.

The social proof in the home page trust section comes from nowhere: **4.8 / 5**, **92%
would book again**, *Traveller Choice 2026*, *Flexible Stay Recognition* and the three guest
reviews are invented for this prototype. They are labelled *demo award* and *student project
concept* in place, and the section closes with a disclosure saying reviews, ratings and
awards here are fictional and made for educational demonstration. No real organisation is
named or implied.

## Assumptions

- `Claude_ZO_Hotel_Website_Master_Prompt.md` was referenced but never supplied, so
  requirements were taken from the assignment brief, the Zoho UI Best Practices manual, the
  current ZO site, and the redesign direction given in conversation.
- ZO Hotel is fictional. Rates, GST slabs (12% up to ₹7,500 a night, 18% above), and refund
  windows are modelled on real Indian hotel practice; the brand, reviews and registration
  details are invented for coursework.
