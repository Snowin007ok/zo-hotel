# ZO Hotel — stays in Mumbai and Goa

A working hotel website for the content-writing assignment on booking cancellations.
Open `index.html` in a browser. No build step, no dependencies, no network access —
everything runs from the file system.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | The hotel home page. Photography-led: hero, destinations, experience, rooms, meetings, then flexible booking as reassurance. |
| `flexible-booking.html` | **Part B in full** — the six cancellation reasons with answers, the whole policy table, the evidence, and the trust section. |
| `part-a-exit-prompt.html` | **Part A** — the exit prompt, running live, with its four required pieces of copy and the rule behind each decision. |
| `booking.html` | Booking form: live pricing, GST, full client-side validation, confirmation. |
| `manage.html` | Where the exit prompt fires. Look up a booking, change dates, add requests, cancel. |
| `style-guide.html` | The copy decisions this site commits to, with before/after against the current ZO site. |
| `tests/browser-check.html` | Open it to drive the real dialogs in your browser and see 56 behaviour checks pass. |

## Photography

The seven supplied images are used once each, never scaled beyond their own pixels.
**Filenames did not match content**, so they are assigned by what they actually show:

| File | Actual content | Used for |
| --- | --- | --- |
| `goa-resort.jpg` (1846×1230) | Goa beach + cliffside resort, golden hour | Home hero, full bleed |
| `hero-goa..jpg` (1200×943) | Grand city hotel at dusk, courtyard pool | Mumbai destination panel |
| `mumbai-hotel.jpg` (900×600) | Night resort pool, lit villas | Goa destination panel |
| `pool.jpg` (1900×750) | Day poolside, palms, loungers | Experience section, exit-prompt dialog |
| `dining.avif` (500×250) | Poolside restaurant interior | Experience accent, capped at 420px wide |
| `room-ocean.jpeg` (3413×2560) | Resort wing at dusk above a pool | Rooms band |
| `room-business.jpg` (1000×1500) | Banquet hall, blue and white settings | Meetings section |

Added later, outside the supplied seven:

| File | Actual content | Used for |
| --- | --- | --- |
| `award.png` (1010×941) | Gold statuette holding five stars, transparent ground | Recognition column of the home page trust section |

Two notes worth keeping:

- **`hero-goa..jpg` has two dots.** Any reference to `hero-goa.jpg` fails silently in a
  browser. A test asserts every referenced image exists on disk.
- `room-business.jpg` shows another hotel's logo on a projector screen, so it is framed
  with `object-position: center 82%` to keep that out of shot. It is a banquet hall, not a
  bedroom, so it sells meetings rather than a room.
- No supplied photograph shows a guest room. Rooms are therefore a photographic band plus
  an editorial rate list, rather than four cards with imagery that would be a lie.
- **`award.png` is mostly empty.** The statuette sits in `x 409–599, y 0–588` of a
  1010×941 canvas; below it the file carries two decorative rules and some white lettering
  that would ghost on a warm background. Shown whole it would shrink to a thumbnail inside
  its own whitespace, so `.award__frame` is a clipping window onto `x 369–639, y 0–596`.
  The file is still displayed at its own proportions — `height: auto`, never stretched —
  and only the empty margins are cropped.

## What works, not just what renders

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
  glyphs marked `aria-hidden` with a "Rated 5 out of 5" text alternative beside them.

### Reproducible demo paths

- Sold-out dates: **24 Dec – 1 Jan** at either hotel, **14–16 Feb** in Goa.
- Demo booking on `manage.html`: `ZO-4193-MUM` / `guest@example.com`.
- Bookings are stored in `localStorage` for this browser only.

## Tests

```bash
node --test tests/logic.test.js      # 37 tests: pricing, refunds, validation, copy audit
open tests/browser-check.html        # 56 checks: dialogs, focus, flows, overflow, console
```

The copy audit is not decorative: it fails the build if any page gains an exclamation
point, a "Click here", an "Are you sure", an image without alt text or dimensions, a
missing asset, a broken internal link, or the phrase "why guests cancel".

## Where the numbers come from

Cancellation figures on `flexible-booking.html` and `part-a-exit-prompt.html` come from the
119,390-row hotel booking dataset supplied with the assignment (37% overall cancellation
rate). The load-bearing finding is that bookings which get **changed** cancel 14% of the
time against 41% for bookings nobody touches — which is why the exit prompt offers a date
change rather than arguing with the guest.

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
