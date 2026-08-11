/* =============================================================================
   Tests for the ZO Hotel business rules and copy claims.
   Run with:  node --test tests/
   ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const L = require('../assets/js/logic.js');

const ROOT = path.join(__dirname, '..');

/* --------------------------------------------------------------------------
   Dates
   ----------------------------------------------------------------------- */

test('parseISO accepts valid dates and rejects impossible ones', () => {
  assert.equal(L.toISO(L.parseISO('2026-08-14')), '2026-08-14');
  assert.equal(L.parseISO('2026-02-31'), null, 'February has no 31st');
  assert.equal(L.parseISO('2026-13-01'), null, 'no 13th month');
  assert.equal(L.parseISO('14/08/2026'), null, 'only ISO input is accepted');
  assert.equal(L.parseISO(''), null);
  assert.equal(L.parseISO(null), null);
  assert.equal(L.toISO(L.parseISO('2028-02-29')), '2028-02-29', 'leap day is valid');
});

test('nights counts whole nights and addDays crosses month ends', () => {
  assert.equal(L.nights('2026-08-14', '2026-08-17'), 3);
  assert.equal(L.nights('2026-08-14', '2026-08-14'), 0);
  assert.equal(L.nights('2026-08-17', '2026-08-14'), -3);
  assert.equal(L.addDays('2026-08-30', 3), '2026-09-02');
  assert.equal(L.addDays('2027-01-01', -1), '2026-12-31');
});

test('dates render in Indian order, never month-first', () => {
  assert.equal(L.formatDate('2026-08-14'), '14 Aug 2026');
  assert.equal(L.formatDateRange('2026-08-14', '2026-08-17'), '14–17 Aug 2026');
  assert.equal(L.formatDateRange('2026-08-30', '2026-09-02'), '30 Aug – 2 Sep 2026');
  assert.equal(L.formatTimeOfDay(14), '2:00 pm');
  assert.equal(L.formatTimeOfDay(11), '11:00 am');
  assert.equal(L.formatTimeOfDay(12), '12:00 pm');
});

/* --------------------------------------------------------------------------
   Money
   ----------------------------------------------------------------------- */

test('currency uses Indian digit grouping', () => {
  assert.equal(L.formatINR(999), '₹999');
  assert.equal(L.formatINR(6999), '₹6,999');
  assert.equal(L.formatINR(23517), '₹23,517');
  assert.equal(L.formatINR(100000), '₹1,00,000');
  assert.equal(L.formatINR(1234567), '₹12,34,567');
  assert.equal(L.formatINR(0), '₹0');
});

test('GST follows the Indian room-tariff slabs', () => {
  assert.equal(L.gstRate(6999), 0.12);
  assert.equal(L.gstRate(7500), 0.12, '7,500 sits in the lower slab');
  assert.equal(L.gstRate(7501), 0.18);
  assert.equal(L.gstRate(12499), 0.18);
});

test('quote prices a stay, its extras and its tax', () => {
  const q = L.quote({ roomId: 'city', planId: 'flexible', checkIn: '2026-08-14', checkOut: '2026-08-17' });
  assert.equal(q.nights, 3);
  assert.equal(q.nightly, 6999);
  assert.equal(q.roomTotal, 20997);
  assert.equal(q.taxRate, 0.12);
  assert.equal(q.tax, 2520);
  assert.equal(q.total, 23517);

  const withBed = L.quote({
    roomId: 'city', planId: 'flexible', checkIn: '2026-08-14', checkOut: '2026-08-17',
    requests: { extraBed: true }
  });
  assert.equal(withBed.extras, 2700, '900 a night for three nights');
  assert.equal(withBed.total, 20997 + 2700 + Math.round((20997 + 2700) * 0.12));

  assert.equal(L.quote({ roomId: 'city', planId: 'flexible', checkIn: '2026-08-14', checkOut: '2026-08-14' }), null);
  assert.equal(L.quote({ roomId: 'nope', planId: 'flexible', checkIn: '2026-08-14', checkOut: '2026-08-17' }), null);
});

test('cheaper rates really are cheaper, and the Saver saves the most', () => {
  const flex = L.nightlyRate('city', 'flexible');
  const semi = L.nightlyRate('city', 'semiflex');
  const saver = L.nightlyRate('city', 'saver');
  assert.ok(saver < semi && semi < flex);
  assert.equal(flex, 6999);
  assert.equal(semi, 6439);
  assert.equal(saver, 5739);
});

/* --------------------------------------------------------------------------
   Availability
   ----------------------------------------------------------------------- */

test('sold-out windows are deterministic and wrap the new year', () => {
  assert.equal(L.checkAvailability('mumbai', '2026-12-20', '2026-12-23').available, true);
  assert.equal(L.checkAvailability('mumbai', '2026-12-24', '2026-12-26').available, false);
  assert.equal(L.checkAvailability('mumbai', '2026-12-31', '2027-01-02').available, false);
  assert.equal(L.checkAvailability('mumbai', '2027-01-02', '2027-01-04').available, true);

  // A stay that only passes through the window is still blocked.
  const spanning = L.checkAvailability('mumbai', '2026-12-22', '2026-12-27');
  assert.equal(spanning.available, false);
  assert.match(spanning.label, /new year/);

  // Property-specific block.
  assert.equal(L.checkAvailability('goa', '2026-02-14', '2026-02-16').available, false);
  assert.equal(L.checkAvailability('mumbai', '2026-02-14', '2026-02-16').available, true);

  // The last night is the night before check-out, so this is clear.
  assert.equal(L.checkAvailability('mumbai', '2026-12-23', '2026-12-24').available, true);
});

/* --------------------------------------------------------------------------
   Booking validation
   ----------------------------------------------------------------------- */

const NOW = new Date(2026, 7, 10, 9, 0, 0); // 10 Aug 2026, 9:00 am

function validBooking(overrides) {
  return Object.assign({
    property: 'mumbai',
    roomId: 'city',
    planId: 'flexible',
    checkIn: '2026-08-20',
    checkOut: '2026-08-23',
    guests: '2',
    fullName: 'Divya R',
    email: 'divya@example.com',
    phone: '9876543210',
    consent: true
  }, overrides || {});
}

test('a complete booking passes', () => {
  const result = L.validateBooking(validBooking(), NOW);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(result.errors, {});
});

test('an empty form reports every required field once', () => {
  const result = L.validateBooking({
    property: '', roomId: '', planId: '', checkIn: '', checkOut: '',
    guests: '', fullName: '', email: '', phone: '', consent: false
  }, NOW);
  assert.equal(result.valid, false);
  ['checkIn', 'checkOut', 'guests', 'property', 'roomId', 'planId', 'fullName', 'email', 'phone', 'consent']
    .forEach((field) => assert.ok(result.errors[field], `expected an error for ${field}`));
});

test('date rules', () => {
  assert.match(L.validateBooking(validBooking({ checkIn: '2026-08-09' }), NOW).errors.checkIn, /cannot be in the past/);
  // Today is allowed.
  assert.equal(L.validateBooking(validBooking({ checkIn: '2026-08-10', checkOut: '2026-08-12' }), NOW).valid, true);
  assert.match(L.validateBooking(validBooking({ checkOut: '2026-08-20' }), NOW).errors.checkOut, /at least one night/);
  assert.match(L.validateBooking(validBooking({ checkOut: '2026-08-19' }), NOW).errors.checkOut, /at least one night/);
  assert.match(L.validateBooking(validBooking({ checkOut: '2026-09-25' }), NOW).errors.checkOut, /up to 30 nights/);
  assert.match(L.validateBooking(validBooking({ checkIn: '20-08-2026' }), NOW).errors.checkIn, /dd\/mm\/yyyy/);
});

test('guest count rules', () => {
  assert.match(L.validateBooking(validBooking({ guests: '0' }), NOW).errors.guests, /1 or more/);
  assert.match(L.validateBooking(validBooking({ guests: '2.5' }), NOW).errors.guests, /whole number/);
  assert.match(L.validateBooking(validBooking({ guests: 'two' }), NOW).errors.guests, /whole number/);
  assert.match(L.validateBooking(validBooking({ guests: '9' }), NOW).errors.guests, /up to 8 guests/);
  // Four guests do not fit a room that sleeps two.
  assert.match(L.validateBooking(validBooking({ guests: '4' }), NOW).errors.roomId, /sleeps 2/);
  assert.equal(L.validateBooking(validBooking({ guests: '4', roomId: 'family' }), NOW).valid, true);
});

test('a room must exist at the chosen property', () => {
  const result = L.validateBooking(validBooking({ property: 'goa', roomId: 'business' }), NOW);
  assert.match(result.errors.roomId, /not at ZO Hotel Goa/);
  assert.equal(L.validateBooking(validBooking({ property: 'goa', roomId: 'resort', guests: '2' }), NOW).valid, true);
});

test('contact details', () => {
  assert.match(L.validateBooking(validBooking({ email: 'divya@' }), NOW).errors.email, /name@example.com/);
  assert.match(L.validateBooking(validBooking({ email: 'divya example.com' }), NOW).errors.email, /name@example.com/);
  assert.match(L.validateBooking(validBooking({ phone: '12345' }), NOW).errors.phone, /10-digit/);
  assert.match(L.validateBooking(validBooking({ phone: '1234567890' }), NOW).errors.phone, /10-digit/);
  // Common ways of writing an Indian mobile number all pass.
  ['+91 98765 43210', '098765-43210', '9876543210', '91 9876543210'].forEach((phone) => {
    assert.equal(L.validateBooking(validBooking({ phone }), NOW).valid, true, phone);
  });
});

test('the consent box is required, and sold-out dates fail with an apology', () => {
  assert.match(L.validateBooking(validBooking({ consent: false }), NOW).errors.consent, /cancellation policy/);
  const soldOut = L.validateBooking(validBooking({ checkIn: '2026-12-24', checkOut: '2026-12-27' }), NOW);
  assert.match(soldOut.errors.checkOut, /^Sorry, we are sold out/);
});

test('error copy stays non-accusatory and free of exclamation points', () => {
  const messages = [];
  [
    { checkIn: '' }, { checkOut: '' }, { guests: '' }, { email: 'x' }, { phone: '1' },
    { fullName: '' }, { consent: false }, { checkOut: '2026-09-25' }, { guests: '9' }
  ].forEach((patch) => {
    const errors = L.validateBooking(validBooking(patch), NOW).errors;
    Object.keys(errors).forEach((key) => messages.push(errors[key]));
  });
  assert.ok(messages.length > 5);
  messages.forEach((message) => {
    assert.doesNotMatch(message, /!/, `no exclamation points: ${message}`);
    assert.doesNotMatch(message, /you (didn't|did not|failed|must not)/i, `not accusatory: ${message}`);
    assert.doesNotMatch(message, /are you sure/i, `no "are you sure": ${message}`);
    // A single simple sentence takes no period; anything longer does.
    const complex = message.includes(',') || /\.\s/.test(message);
    if (!complex) assert.doesNotMatch(message, /\.$/, `simple sentence keeps no period: ${message}`);
  });
});

/* --------------------------------------------------------------------------
   Lookup validation
   ----------------------------------------------------------------------- */

test('booking reference format is enforced, case-insensitively', () => {
  assert.equal(L.validateLookup({ reference: 'ZO-4193-MUM', email: 'a@b.com' }).valid, true);
  assert.equal(L.validateLookup({ reference: 'zo-4193-mum', email: 'a@b.com' }).valid, true);
  assert.match(L.validateLookup({ reference: '4193', email: 'a@b.com' }).errors.reference, /ZO-1234-MUM/);
  assert.match(L.validateLookup({ reference: '', email: 'a@b.com' }).errors.reference, /Please enter/);
  assert.match(L.validateLookup({ reference: 'ZO-4193-MUM', email: '' }).errors.email, /Please enter/);
});

/* --------------------------------------------------------------------------
   Refunds
   ----------------------------------------------------------------------- */

function bookingOn(planId, checkIn, total) {
  return {
    planId, checkIn, checkOut: L.addDays(checkIn, 3),
    total: total || 23517, roomId: 'city', property: 'mumbai', changesUsed: 0
  };
}

test('the Flexible rate refunds in full until 24 hours before check-in', () => {
  const b = bookingOn('flexible', '2026-09-01');
  // Well before the deadline.
  let r = L.refundQuote(b, new Date(2026, 7, 20, 10, 0));
  assert.equal(r.tier, 'full');
  assert.equal(r.pct, 1);
  assert.equal(r.amount, 23517);
  assert.match(r.headline, /Full refund of ₹23,517/);
  assert.equal(r.deadline, '31 Aug 2026, 2:00 pm');

  // Exactly 24 hours out is still free.
  r = L.refundQuote(b, new Date(2026, 7, 31, 14, 0));
  assert.equal(r.tier, 'full');

  // A minute later it is not.
  r = L.refundQuote(b, new Date(2026, 7, 31, 14, 1));
  assert.equal(r.tier, 'late');
  assert.equal(r.amount, 0);

  // Once the stay has started.
  r = L.refundQuote(b, new Date(2026, 8, 1, 15, 0));
  assert.equal(r.tier, 'started');
  assert.equal(r.amount, 0);
});

test('Semi-flex refunds in full for seven days, then half', () => {
  const b = bookingOn('semiflex', '2026-09-10', 20000);
  let r = L.refundQuote(b, new Date(2026, 8, 1, 9, 0));
  assert.equal(r.tier, 'full');
  assert.equal(r.amount, 20000);

  r = L.refundQuote(b, new Date(2026, 8, 5, 9, 0));
  assert.equal(r.tier, 'partial');
  assert.equal(r.pct, 0.5);
  assert.equal(r.amount, 10000);
  assert.match(r.headline, /Partial refund of ₹10,000 \(50%\)/);
});

test('the Saver rate never refunds, however early the guest cancels', () => {
  const b = bookingOn('saver', '2027-01-20', 18000);
  const r = L.refundQuote(b, new Date(2026, 7, 10, 9, 0));
  assert.equal(r.tier, 'nonrefundable');
  assert.equal(r.amount, 0);
  assert.match(r.headline, /No refund on the Saver rate/);
});

test('every refund quote states a timeline', () => {
  ['flexible', 'semiflex', 'saver'].forEach((planId) => {
    const r = L.refundQuote(bookingOn(planId, '2026-09-01'), NOW);
    assert.equal(r.refundDays, '5–7 business days');
  });
});

/* --------------------------------------------------------------------------
   Date changes
   ----------------------------------------------------------------------- */

test('a date change is free while free changes remain, then costs the fee', () => {
  const b = bookingOn('flexible', '2026-09-01');
  b.checkOut = '2026-09-04';

  let c = L.changeQuote(b, '2026-09-08', '2026-09-11', NOW);
  assert.equal(c.valid, true, JSON.stringify(c.errors));
  assert.equal(c.fee, 0);
  assert.equal(c.freeChangesLeft, 2);
  assert.equal(c.freeChangesAfter, 1);
  assert.equal(c.newQuote.nights, 3);

  b.changesUsed = 2;
  c = L.changeQuote(b, '2026-09-08', '2026-09-11', NOW);
  assert.equal(c.fee, 750, 'the Flexible change fee applies once the free ones are used');
  assert.equal(c.freeChangesLeft, 0);
  assert.equal(c.freeChangesAfter, 0);
});

test('a longer stay costs more, a shorter one refunds the difference', () => {
  const b = bookingOn('flexible', '2026-09-01');
  b.checkOut = '2026-09-04';
  b.total = L.quote({ roomId: 'city', planId: 'flexible', checkIn: '2026-09-01', checkOut: '2026-09-04' }).total;

  const longer = L.changeQuote(b, '2026-09-08', '2026-09-13', NOW);
  assert.ok(longer.difference > 0);
  assert.equal(longer.payable, longer.difference);
  assert.equal(longer.refundable, 0);

  const shorter = L.changeQuote(b, '2026-09-08', '2026-09-10', NOW);
  assert.ok(shorter.difference < 0);
  assert.equal(shorter.payable, 0);
  assert.equal(shorter.refundable, -shorter.difference);
});

test('date changes refuse bad input and sold-out dates', () => {
  const b = bookingOn('flexible', '2026-09-01');
  b.checkOut = '2026-09-04';

  assert.match(L.changeQuote(b, '2026-09-01', '2026-09-04', NOW).errors.checkIn, /dates you already have/);
  assert.match(L.changeQuote(b, '2026-08-01', '2026-08-04', NOW).errors.checkIn, /cannot be in the past/);
  assert.match(L.changeQuote(b, '2026-09-08', '2026-09-08', NOW).errors.checkOut, /at least one night/);
  assert.match(L.changeQuote(b, '', '', NOW).errors.checkIn, /Please enter/);

  const soldOut = L.changeQuote(b, '2026-12-24', '2026-12-27', NOW);
  assert.equal(soldOut.valid, false);
  assert.equal(soldOut.availability.available, false);
  assert.deepEqual(soldOut.errors, {}, 'availability is reported separately from field errors');
});

/* --------------------------------------------------------------------------
   References and masking
   ----------------------------------------------------------------------- */

test('references follow the documented shape and masking hides the address', () => {
  const ref = L.bookingRef('goa', 4193);
  assert.match(ref, /^ZO-\d{4}-GOA$/);
  assert.equal(L.validateLookup({ reference: ref, email: 'a@b.com' }).valid, true);

  // A random reference must still satisfy the lookup rule.
  for (let i = 0; i < 50; i++) {
    assert.match(L.bookingRef('mumbai'), /^ZO-\d{4}-MUM$/);
  }

  assert.equal(L.refundRef('ZO-4193-MUM'), 'RF-4193-4193');
  assert.equal(L.maskEmail('guest@example.com'), 'g•••t@example.com');
  assert.equal(L.maskEmail('ab@example.com'), 'a•••@example.com');
  assert.equal(L.maskEmail(''), '');
});

/* --------------------------------------------------------------------------
   Copy audit — the style claims this project makes about itself
   ----------------------------------------------------------------------- */

function visibleText(html) {
  return html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');
}

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

test('every page is present and declares a language and a title', () => {
  assert.deepEqual(
    htmlFiles.sort(),
    ['booking.html', 'flexible-booking.html', 'index.html', 'manage.html',
      'part-a-exit-prompt.html', 'style-guide.html']
  );
  htmlFiles.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(html, /<html lang="en-IN">/, `${file} sets a language`);
    assert.match(html, /<title>[^<]+<\/title>/, `${file} has a title`);
    assert.match(html, /name="viewport"/, `${file} is responsive`);
    assert.match(html, /class="skip-link"/, `${file} has a skip link`);
    assert.match(html, /<main id="main"/, `${file} has a main landmark`);
  });
});

test('no page contains an exclamation point in visible copy', () => {
  htmlFiles.forEach((file) => {
    const text = visibleText(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const hit = text.indexOf('!');
    assert.equal(hit, -1, `${file} contains "!" near: ${text.slice(Math.max(0, hit - 60), hit + 40)}`);
  });
});

test('no page uses "Click here", a bare "Learn more", or "Are you sure"', () => {
  htmlFiles.forEach((file) => {
    const text = visibleText(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    // The style guide quotes these as examples of what to avoid, so it is exempt.
    if (file === 'style-guide.html' || file === 'part-a-exit-prompt.html') return;
    assert.doesNotMatch(text, /click here/i, `${file}`);
    assert.doesNotMatch(text, /\bLearn more\b/, `${file}`);
    assert.doesNotMatch(text, /are you sure/i, `${file}`);
  });
});

test('every form control has a label, and no placeholder stands in for one', () => {
  ['booking.html', 'manage.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(html, /<input[^>]*placeholder=/i, `${file} uses visible hints instead of placeholders`);

    // Each text-like input carries a matching <label for>.
    const ids = [...html.matchAll(/<(?:input|select|textarea)[^>]*id="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((id) => !/^req-|^plan-/.test(id));
    ids.forEach((id) => {
      assert.ok(
        html.includes(`for="${id}"`),
        `${file}: control #${id} needs a <label for="${id}">`
      );
    });
  });
});

test('dialog markup in flows.js is accessible and free of exclamation points', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/flows.js'), 'utf8');
  const window = { ZO: {}, HTMLElement: function () {} };
  const document = { addEventListener() {} };
  // flows.js only touches the DOM inside functions, so it loads with stubs.
  new Function('window', 'document', src)(window, document);

  const Flows = window.ZO.Flows;
  assert.ok(Flows, 'flows.js exposes ZO.Flows');

  const variants = Object.keys(Flows.VARIANTS);
  assert.deepEqual(variants.sort(), ['dates', 'price', 'requests']);

  variants.forEach((key) => {
    const v = Flows.VARIANTS[key];
    ['headline', 'message'].forEach((field) => {
      assert.ok(v[field] && v[field].length > 0, `${key}.${field} exists`);
      assert.doesNotMatch(v[field], /!/, `${key}.${field} has no exclamation point`);
      assert.doesNotMatch(v[field], /are you sure/i, `${key}.${field} avoids "are you sure"`);
    });

    // Headlines are sentence case: no interior capitalised word except a name.
    assert.match(v.headline[0], /[A-Z]/, `${key} headline starts with a capital`);
    assert.doesNotMatch(v.headline, /\.$/, `${key} headline takes no trailing period`);

    // The guide's first rule: one action verb across header, description, CTA.
    const verb = v.primary.label.split(' ')[0];
    const carriesVerb = new RegExp(`\\b${verb}\\b`, 'i');
    assert.match(v.headline, carriesVerb, `${key} headline carries the verb "${verb}"`);
    assert.match(v.message, carriesVerb, `${key} description carries the verb "${verb}"`);

    // The primary CTA names an action rather than saying OK or Continue.
    assert.doesNotMatch(v.primary.label, /^(ok|okay|continue|proceed|submit|yes|no)$/i);
    assert.ok(v.primary.action, `${key} primary CTA has an action`);

    // Two choices only, so the prompt carries no third "keep" button.
    assert.equal(v.secondary, undefined, `${key} has no third CTA`);
    assert.equal(v.tertiary, undefined, `${key} has no third CTA`);
  });

  // Every reason that offers a fix names its button.
  Flows.REASONS.forEach((r) => {
    assert.ok(r.label, 'reason has a label');
    assert.doesNotMatch(r.label, /!/);
    if (r.offer) {
      assert.ok(r.offerCta && r.offerTitle, `${r.id} offer names a CTA and a title`);
      assert.doesNotMatch(r.offerCta, /^(ok|continue)$/i);
    }
  });

  // Each dialog photograph is a real file with alternative text and dimensions.
  assert.deepEqual(Object.keys(Flows.ART).sort(), ['dates', 'price', 'requests']);
  Object.keys(Flows.ART).forEach((key) => {
    const art = Flows.ART[key];
    assert.ok(fs.existsSync(path.join(ROOT, art.src)), `${key} art file exists: ${art.src}`);
    assert.ok(art.alt && art.alt.length > 20, `${key} art has descriptive alternative text`);
    assert.ok(art.width > 0 && art.height > 0, `${key} art declares its dimensions`);
    assert.doesNotMatch(art.alt, /!/);
  });
});

test('every photograph referenced by a page exists on disk', () => {
  // The supplied hero file is named "hero-goa..jpg", with two dots, so a typo
  // here is silent in a browser but fatal to the design.
  let checked = 0;
  htmlFiles.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const sources = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    sources.forEach((src) => {
      if (/^(https?:|data:)/.test(src)) return;
      assert.ok(fs.existsSync(path.join(ROOT, src)), `${file} references a missing image: ${src}`);
      checked++;
    });
  });
  assert.ok(checked >= 8, `expected the pages to use the photography, saw ${checked} images`);
});

test('every image carries alternative text and intrinsic dimensions', () => {
  htmlFiles.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]).forEach((tag) => {
      assert.match(tag, /\salt="/, `${file}: image without alt text — ${tag.slice(0, 70)}`);
      assert.match(tag, /\swidth="\d+"/, `${file}: image without width — ${tag.slice(0, 70)}`);
      assert.match(tag, /\sheight="\d+"/, `${file}: image without height — ${tag.slice(0, 70)}`);
    });
  });
});

test('stylesheets and scripts referenced by a page exist', () => {
  htmlFiles.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const refs = [
      ...[...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
    ];
    refs.forEach((ref) => {
      assert.ok(fs.existsSync(path.join(ROOT, ref)), `${file} references a missing asset: ${ref}`);
    });
  });
});

test('internal page links point at files that exist', () => {
  htmlFiles.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    [...html.matchAll(/href="([^"#:]+\.html)(#[^"]*)?"/g)].forEach((m) => {
      assert.ok(fs.existsSync(path.join(ROOT, m[1])), `${file} links to a missing page: ${m[1]}`);
    });
  });
});

test('the customer-facing pages never say "why guests cancel"', () => {
  // Internal business language, per the brief. It must not reach a guest.
  htmlFiles.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(html, /why guests cancel/i, `${file}`);
  });
});

test('the exit prompt keeps the destructive route available but not default', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/flows.js'), 'utf8');
  // Cancelling is a quiet button; the alternative is the filled one.
  assert.match(src, /btn--quiet-danger" data-exit-cancel/);
  assert.match(src, /btn--primary" data-exit-primary/);
  // The confirmation step uses the same verb in header, description and button.
  assert.match(src, /'Cancel booking\?'/);
  assert.match(src, /'Cancel non-refundable booking\?'/);
  assert.match(src, /'Cancel your ' \+ p\.name/);
  assert.match(src, /data-confirm-cancel>Cancel booking</);
  // On the consequential step the safe action is the emphasised one.
  assert.match(src, /btn--primary"[^>]*data-confirm-keep[^>]*>Keep booking</);
  assert.match(src, /btn--quiet-danger" data-confirm-cancel/);
});

test('the forcing function fires only when the guest loses the whole amount', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/flows.js'), 'utf8');
  // One predicate decides it, so the friction cannot drift onto refundable rates.
  assert.match(src, /function losesEverything\(b\) \{[\s\S]*?refund\.amount === 0 && b\.total > 0/);
  assert.match(src, /forceField\.hidden = !needsForce/);
  assert.match(src, /var needsForce = losesEverything\(b\)/);
  // And it says out loud why the destructive button is unavailable.
  assert.match(src, /Cancel booking is unavailable until you type CANCEL/);
  assert.match(src, /aria-live="polite"/);
});

test('dialogs declare the ARIA a modal needs', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/flows.js'), 'utf8');
  const shells = src.match(/role="dialog"/g) || [];
  assert.equal(shells.length, 1, 'all dialogs share one shell helper');
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /aria-labelledby="' \+ id \+ '-title"/);
  assert.match(src, /aria-describedby="' \+ id \+ '-desc"/);
});
