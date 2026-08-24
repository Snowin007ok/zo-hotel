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
    ['booking.html', 'flexible-booking.html', 'goa.html', 'index.html', 'manage.html',
      'mumbai.html', 'part-a-exit-prompt.html', 'style-guide.html']
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

      /* alt="" and a missing alt are not the same thing: the first declares a
         decorative image, the second is a defect. Only the brand marks are
         decorative here, because the wordmark beside them already says the
         name — anything else with an empty alt is a description someone forgot
         to write, and this is where that gets caught. */
      if (/\salt=""/.test(tag)) {
        assert.match(tag, /class="(?:brand__mark|footer-brand__mark)"/,
          `${file}: empty alt on a non-decorative image — ${tag.slice(0, 90)}`);
      } else {
        const alt = tag.match(/\salt="([^"]*)"/)[1];
        assert.ok(alt.length > 15,
          `${file}: alt="${alt}" is too thin to describe anything`);
      }
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

test('a destination panel opens its property page, never the booking form', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // The two discovery panels are the whole journey's first step. If either one
  // regresses to booking.html the middle of the funnel disappears silently.
  assert.match(home, /class="place[^"]*" id="mumbai" href="mumbai\.html"/);
  assert.match(home, /class="place[^"]*" id="goa" href="goa\.html"/);

  // And the same two names in the navigation go to the same two pages.
  htmlFiles.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(html, /href="mumbai\.html"[^>]*>Mumbai</, `${file} navigates to the Mumbai page`);
    assert.match(html, /href="goa\.html"[^>]*>Goa</, `${file} navigates to the Goa page`);
  });
});

test('every property page booking CTA names its property in the query string', () => {
  [['mumbai.html', 'mumbai', 'goa'], ['goa.html', 'goa', 'mumbai']].forEach(([file, own, other]) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');

    // Each link to the booking form carries this property, so the form opens
    // on the hotel the guest was reading about.
    const bookingLinks = [...html.matchAll(/href="(booking\.html[^"]*)"/g)].map((m) => m[1]);
    assert.ok(bookingLinks.length >= 4, `${file} has booking CTAs, saw ${bookingLinks.length}`);
    bookingLinks.forEach((href) => {
      assert.ok(
        href.includes(`property=${own}`),
        `${file}: booking link without property=${own} — ${href}`
      );
      assert.ok(!href.includes(`property=${other}`), `${file}: booking link names ${other} — ${href}`);
    });

    // Rooms sold at this property only, and the room ids booking.js knows.
    const rooms = [...html.matchAll(/room=([a-z]+)/g)].map((m) => m[1]);
    assert.ok(rooms.length >= 2, `${file} links at least two rooms`);
    rooms.forEach((id) => {
      assert.ok(L.ROOMS[id], `${file}: unknown room id "${id}"`);
      assert.ok(
        L.ROOMS[id].properties.includes(own),
        `${file}: ${id} is not sold at ${own}`
      );
    });

    // Every price shown is the tariff the booking page will quote.
    rooms.forEach((id) => {
      assert.ok(
        html.includes(L.formatINR(L.ROOMS[id].base)),
        `${file}: ${id} price does not match the rate card`
      );
    });

    // The anchor both hero CTAs point at has to exist.
    assert.match(html, /id="rooms"/, `${file} has a rooms section to jump to`);

    // Flexibility appears once as reassurance and points at the policy page.
    // It must not become a second copy of it.
    const flexSections = [...html.matchAll(/id="flexible"/g)];
    assert.equal(flexSections.length, 1, `${file} carries one flexible-booking section`);
    const flexCtas = [...html.matchAll(/See flexible booking options/g)];
    assert.equal(flexCtas.length, 1, `${file} states the flexible-booking CTA once`);
    assert.doesNotMatch(html, /<table class="data"/, `${file} leaves the policy table on its own page`);
  });
});

test('the property pages keep coursework language off a customer-facing page', () => {
  ['mumbai.html', 'goa.html'].forEach((file) => {
    const text = visibleText(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    [/\bdataset\b/i, /\bretention\b/i, /\bconversion\b/i, /cancellation reduction/i,
      /cancellation reasons/i].forEach((pattern) => {
      assert.doesNotMatch(text, pattern, `${file} carries internal language: ${pattern}`);
    });
  });
});

test('a room detail panel is a labelled region its own button controls', () => {
  ['mumbai.html', 'goa.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    // The accordion script only runs inside a [data-accordion] root.
    assert.match(html, /class="rates" data-accordion/, `${file} wires the rate list to the accordion`);

    const controls = [...html.matchAll(/aria-controls="(room-[a-z]+)" id="(room-[a-z]+-btn)"/g)];
    assert.ok(controls.length >= 2, `${file} has room toggles, saw ${controls.length}`);
    controls.forEach(([, panelId, btnId]) => {
      assert.equal(`${panelId}-btn`, btnId, `${file}: ${panelId} pairs with its own button`);
      assert.match(
        html,
        new RegExp(`id="${panelId}" role="region" aria-labelledby="${btnId}"`),
        `${file}: ${panelId} is a region labelled by ${btnId}`
      );
    });
  });
});

test('every borrowed photograph is credited on the page that uses it', () => {
  // The nearby-attraction photographs come from Wikimedia Commons under CC BY
  // and CC BY-SA, which require attribution. A photograph added without a
  // credit is a licence breach, not a style slip, so it fails here.
  ['mumbai.html', 'goa.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const borrowed = [...html.matchAll(/src="assets\/img\/(near-[\w-]+\.jpg)"/g)].map((m) => m[1]);
    // Mumbai carries five, Goa four. What matters is that the count and the
    // number of credited photographers move together, which is asserted below.
    assert.ok(borrowed.length >= 4, `${file} shows its nearby places, saw ${borrowed.length}`);
    assert.match(html, /class="nearby(?: nearby--five)?"/, `${file} uses the nearby grid`);
    if (borrowed.length === 5) {
      assert.match(html, /class="nearby nearby--five"/,
        `${file} has five cards, so the grid must take five columns`);
    }

    borrowed.forEach((f) => {
      assert.ok(fs.existsSync(path.join(ROOT, 'assets/img', f)), `${file}: ${f} is on disk`);
    });

    // One credit block, naming its source and at least one licence.
    const credit = html.match(/<p class="nearby__credit">([\s\S]*?)<\/p>/);
    assert.ok(credit, `${file} carries a photograph credit`);
    assert.match(credit[1], /commons\.wikimedia\.org/, `${file} credit names the source`);
    assert.match(
      credit[1],
      /creativecommons\.org\/licenses\/by(-sa)?\/[\d.]+/,
      `${file} credit links a licence`
    );

    // A named photographer for each of the four, so no image rides along
    // unnamed. Whitespace is normalised first: how the credit happens to wrap
    // across lines is not what this test is about.
    const flat = visibleText(credit[1]).replace(/\s+/g, ' ');
    // Lower case is allowed: some photographers are credited by a username.
    // The uppercase "CC BY-SA" of a licence name cannot match this.
    const named = [...flat.matchAll(/ by [A-Za-z]/g)];
    assert.equal(
      named.length, borrowed.length,
      `${file} names a photographer per photograph, saw ${named.length} for ${borrowed.length}`
    );

    // And the disclosure that keeps the fictional hotel apart from the real places.
    assert.match(flat, /hotel itself is fictional/, `${file} separates hotel from place`);
  });
});

test('the nearby sections state no distance or travel time', () => {
  // "Do not invent precise distance claims" — the locators are relational, and
  // a number creeping in later is the failure mode worth catching.
  ['mumbai.html', 'goa.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const section = html.slice(html.indexOf('id="nearby"'), html.indexOf('</section>', html.indexOf('id="nearby"')));
    const text = visibleText(section);
    [/\d+\s*(km|kilometre|kilometer|m|mile|min|minute|hour)\b/i,
      /\b(a|an|one|two|three|four|five|ten|fifteen|twenty|thirty)[- ](minute|min|hour|km|kilometre)\b/i]
      .forEach((pattern) => {
        assert.doesNotMatch(text, pattern, `${file} nearby section states a distance: ${pattern}`);
      });
  });
});

test('all caps stays on micro-labels and never reaches a CTA', () => {
  // The style guide documents a departure from the manual: capitals are allowed
  // on short labels, and ruled out on CTAs, where they read as shouting at the
  // moment of commitment. That second half is the part worth enforcing.
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/main.css'), 'utf8');
  const uppercased = [...css.matchAll(/([^{}]+)\{([^}]*text-transform:\s*uppercase[^}]*)\}/g)]
    .map((m) => m[1].trim().split('\n').pop().trim());

  // Nothing that renders an action may be uppercased.
  uppercased.forEach((sel) => {
    assert.doesNotMatch(sel, /\.btn|\.arrow-link|\.nav__link|\.accordion__btn|button/,
      `all caps on an action: ${sel}`);
  });

  // And every uppercased selector is a known micro-label, so a new one has to
  // be a deliberate addition here rather than a drift.
  const ALLOWED = [
    '.eyebrow', '.brand small', '.searchbar__label', '.place__kicker', '.nearby__where',
    '.story__label', '.benefit h3', '.recognition dd', '.pillar__label', '.proof-strip__label',
    '.concern__label', '.dialog__steps', '.dl-item dt', '.spec__key', '.compare__label',
    '.site-footer h2', '.brandband__tagline'
  ];
  uppercased.forEach((sel) => {
    assert.ok(ALLOWED.includes(sel), `undocumented all-caps selector: ${sel}`);
  });

  // The copy itself is sentence case, so a screen reader hears words.
  ['mumbai.html', 'goa.html', 'index.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    [...html.matchAll(/<p class="(?:eyebrow[^"]*|nearby__where|story__label)">([^<]+)</g)]
      .forEach((m) => {
        const s = m[1].trim();
        assert.notEqual(s, s.toUpperCase(), `${file}: "${s}" is capitalised in the markup`);
      });
  });
});

test('prose in a content section is punctuated as prose', () => {
  // A period on one card in a row of three and not on its neighbours reads as a
  // typo. Every prose string carries one, including single simple sentences.
  const PROSE = [
    ['benefit', /<div class="benefit[^"]*">\s*<h3>[^<]*<\/h3>\s*<p>([^<]+)<\/p>/g],
    ['story line', /<p class="story__line">([^<]+)<\/p>/g],
    ['nearby note', /<p class="nearby__note">\s*([^<]+?)\s*<\/p>/g],
    ['place blurb', /<p class="place__blurb">([^<]+)<\/p>/g]
  ];
  let checked = 0;
  ['index.html', 'mumbai.html', 'goa.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    PROSE.forEach(([name, pattern]) => {
      [...html.matchAll(pattern)].forEach((m) => {
        const s = m[1].replace(/\s+/g, ' ').trim();
        if (!s) return;
        checked++;
        assert.match(s, /[.?]$/, `${file} ${name}: "${s.slice(0, 60)}" needs a period`);
      });
    });
  });
  assert.ok(checked >= 20, `expected the prose components to be covered, saw ${checked}`);
});

/* --------------------------------------------------------------------------
   Accessibility and privacy fixes
   ----------------------------------------------------------------------- */

/** WCAG 2.1 relative luminance of a #rrggbb string. */
function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Read a custom property out of the :root block of main.css. */
function token(css, name) {
  const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
  assert.ok(m, `token --${name} is defined as a hex value`);
  return m[1];
}

test('a hidden button is actually hidden', () => {
  // .btn sets display: inline-flex, which outranks the UA rule for [hidden].
  // Without an override the reason step's offer button stays on screen and
  // stays clickable after the script hides it.
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/main.css'), 'utf8');
  assert.match(css, /\.btn\[hidden\]\s*\{[^}]*display:\s*none/,
    '.btn[hidden] must set display: none');

  // Every component that sets display on a class it also toggles with `hidden`
  // needs the same override, so none of them regress.
  ['.field', '.error-text', '.error-summary', '.banner', '.dialog-backdrop', '.btn']
    .forEach((sel) => {
      assert.match(css, new RegExp(sel.replace('.', '\\.') + '\\[hidden\\]\\s*\\{[^}]*display:\\s*none'),
        `${sel}[hidden] needs display: none`);
    });
});

test('every mandatory field is marked required', () => {
  const booking = fs.readFileSync(path.join(ROOT, 'booking.html'), 'utf8');
  const manage = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');

  // A visible asterisk is a promise to assistive tech that has to be kept.
  const MANDATORY = {
    'booking.html': ['property', 'roomId', 'checkIn', 'checkOut', 'guests',
      'fullName', 'email', 'phone', 'consent'],
    'manage.html': ['reference', 'email']
  };
  Object.entries(MANDATORY).forEach(([file, ids]) => {
    const html = file === 'booking.html' ? booking : manage;
    ids.forEach((id) => {
      const tag = html.match(new RegExp('<(?:input|select|textarea)[^>]*id="' + id + '"[^>]*>'));
      assert.ok(tag, `${file}: control #${id} exists`);
      assert.match(tag[0], /\srequired\b|\saria-required="true"/,
        `${file}: #${id} carries an asterisk, so it must be required`);
    });
  });

  // A required choice group: the group says it is required and each radio
  // carries `required`, so one selection satisfies it.
  assert.match(booking, /<fieldset id="plan-fieldset"[^>]*aria-required="true"/,
    'the rate group declares aria-required');
  assert.match(booking, /<fieldset id="plan-fieldset"[^>]*role="radiogroup"/,
    'the rate group is a radiogroup, so aria-required applies to it');
  assert.match(booking, /<fieldset id="plan-fieldset"[^>]*aria-labelledby="plan-legend"/,
    'the radiogroup is named by its legend');
  assert.match(booking, /id="plan-legend"/, 'the legend carries that id');
  ['flexible', 'semiflex', 'saver'].forEach((planId) => {
    const tag = booking.match(new RegExp('<input[^>]*id="plan-' + planId + '"[^>]*>'));
    assert.match(tag[0], /\srequired\b/, `plan-${planId} carries required`);
  });

  // A radiogroup inside a fieldset would announce two groups, so there is one.
  assert.doesNotMatch(booking, /option-list[^>]*role="radiogroup"/,
    'the radiogroup is not nested inside another group');

  // The price-match link is validated as mandatory, so it says so too.
  const flows = fs.readFileSync(path.join(ROOT, 'assets/js/flows.js'), 'utf8');
  assert.match(flows, /id="price-link"[^>]*\srequired/, 'the price link is required');
  // The forcing-function field is required only while it is in play.
  assert.match(flows, /input\.required = needsForce/,
    'the CANCEL field is required only when the money is unrecoverable');
});

test('text colours meet WCAG AA against every ground they sit on', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/main.css'), 'utf8');
  const white = token(css, 'white');
  const grounds = [['white', white], ['ivory', token(css, 'ivory')],
    ['soft white', token(css, 'soft-white')]];

  // Filled button text. 15px semibold is not "large text", so it needs 4.5:1.
  const btn = token(css, 'teal-btn');
  const btnRatio = contrast(white, btn);
  assert.ok(btnRatio >= 4.5,
    `white on --teal-btn is ${btnRatio.toFixed(2)}:1, needs 4.5:1`);
  // The filled button must not fall back to --teal, which measures 3.94:1.
  assert.match(css, /\.btn--primary\s*\{[^}]*background:\s*var\(--teal-btn\)/,
    '.btn--primary uses the accessible teal');

  // Body-adjacent text colours, against all three page grounds.
  [['muted', 4.5], ['sand-deep', 4.5], ['ink-soft', 4.5], ['ink', 4.5]].forEach(([name, need]) => {
    const fg = token(css, name);
    grounds.forEach(([groundName, bg]) => {
      const r = contrast(fg, bg);
      assert.ok(r >= need,
        `--${name} on ${groundName} is ${r.toFixed(2)}:1, needs ${need}:1`);
    });
  });

  // --sand only ever draws a rule, so it is held to the 3:1 asked of a
  // non-text element rather than to 4.5:1.
  const sandRule = contrast(token(css, 'sand'), token(css, 'ivory'));
  assert.ok(sandRule >= 1.5, `--sand rule on ivory is ${sandRule.toFixed(2)}:1`);
});

test('the manage link carries a reference and no personal information', () => {
  const bookingJs = fs.readFileSync(path.join(ROOT, 'assets/js/booking.js'), 'utf8');
  const manageJs = fs.readFileSync(path.join(ROOT, 'assets/js/manage.js'), 'utf8');

  // The confirmation used to hand the guest a link with their address in it,
  // which lands in history, the referer header and anything they paste.
  const url = bookingJs.match(/var manageUrl = ([^;]+);/s);
  assert.ok(url, 'booking.js builds a manage URL');
  assert.match(url[1], /ref=/, 'the link carries the reference');
  assert.doesNotMatch(url[1], /email/i, 'the link carries no email address');
  assert.doesNotMatch(url[1], /booking\.(email|phone|fullName)/,
    'the link carries no other personal field');

  // And nothing reads an address back out of the query string.
  assert.doesNotMatch(manageJs, /params\.get\(\s*['"]email['"]\s*\)/,
    'manage.js does not accept an email from the URL');

  // A reference on its own still opens the booking, because find() treats the
  // address as optional.
  assert.match(manageJs, /return b\.reference === ref && \(!mail \|\| /,
    'find() matches on the reference alone');
});

test('the browser check resolves assets and proves images decoded', () => {
  const html = fs.readFileSync(path.join(ROOT, 'tests/browser-check.html'), 'utf8');

  // ART paths are written relative to the project root, so this page has to
  // resolve from there or the photograph 404s while the DOM check still passes.
  assert.match(html, /<base href="\.\.\/">/, 'the check resolves paths from the project root');
  assert.doesNotMatch(html, /"\.\.\/assets/, 'no path double-steps out of tests/');

  // complete is true for a 404 as well; naturalWidth is what separates a
  // decoded image from a broken one.
  assert.match(html, /img\.complete && img\.naturalWidth > 0/,
    'the check asserts the image decoded, not merely that the element exists');
  assert.match(html, /naturalWidth=/, 'a failure reports the measured width');

  // Every ART entry names a file that is really on disk at that path.
  const flows = fs.readFileSync(path.join(ROOT, 'assets/js/flows.js'), 'utf8');
  const srcs = [...flows.matchAll(/src:\s*'(assets\/img\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(srcs.length >= 3, `expected the dialog art, saw ${srcs.length}`);
  srcs.forEach((src) => {
    assert.ok(fs.existsSync(path.join(ROOT, src)), `dialog art missing: ${src}`);
  });
});

test('the cancellation reason is optional and the skip is named', () => {
  const flows = fs.readFileSync(path.join(ROOT, 'assets/js/flows.js'), 'utf8');

  // No gate: a guest who will not answer still reaches the review in one click.
  assert.doesNotMatch(flows, /Please pick a reason/,
    'the reason step no longer refuses to continue');
  const handler = flows.match(/\[data-reason-continue\]'\), 'click', function \(\) \{([\s\S]*?)\n    \}\)/);
  assert.ok(handler, 'the continue handler exists');
  assert.doesNotMatch(handler[1], /if \(!state\.reason\)/,
    'the continue handler does not gate on a reason');
  assert.match(handler[1], /goToConfirm/, 'it goes straight to the review');

  // The question says it is optional, in the description and in the legend.
  assert.match(flows, /Answering is optional/, 'the description says it is optional');
  assert.match(flows, /Reason for cancelling, optional/, 'the legend says so too');

  // And the quiet action names the skip while nothing is chosen.
  assert.match(flows, />Skip to cancellation review</,
    'the initial label offers the skip');
  assert.match(flows, /state\.reason \? 'Continue cancellation' : 'Skip to cancellation review'/,
    'the label follows the selection');
});

test('a link that opens the booking form says so', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // "View room" on the home page went to booking.html, which is not viewing a
  // room. The property pages keep the label because there it really does open
  // a detail panel in place.
  const roomLinks = [...home.matchAll(/<a class="arrow-link" href="(booking\.html[^"]*)">([^<]+)<\/a>/g)];
  assert.ok(roomLinks.length >= 4, `expected the rate list links, saw ${roomLinks.length}`);
  roomLinks.forEach(([, href, label]) => {
    assert.doesNotMatch(label, /^View room$/,
      `"${label}" opens ${href}, so it must not claim to view a room`);
    assert.match(label, /Choose this room/, `unexpected label: ${label}`);
  });

  ['mumbai.html', 'goa.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    // There, "View room" is a disclosure button, not a link away.
    assert.doesNotMatch(html, /<a[^>]*href="booking\.html[^"]*"[^>]*>\s*View room/,
      `${file}: View room must not be a link to the booking form`);
    assert.match(html, /<button class="accordion__btn rate__toggle"[^>]*>\s*View room/,
      `${file}: View room is the disclosure button`);
  });
});

test('coursework links and framing stay off the customer-facing pages', () => {
  const CUSTOMER = ['index.html', 'mumbai.html', 'goa.html', 'booking.html',
    'manage.html', 'flexible-booking.html'];
  const DOCS = ['part-a-exit-prompt.html', 'style-guide.html'];

  CUSTOMER.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(html, /href="part-a-exit-prompt\.html"/, `${file} links Part A`);
    assert.doesNotMatch(html, /href="style-guide\.html"/, `${file} links the style guide`);
    const text = visibleText(html);
    [/\bPart A\b/, /\bPart B\b/, /coursework/i, /content-writing assignment/i,
      /student project/i, /educational demonstration/i].forEach((pattern) => {
      assert.doesNotMatch(text, pattern, `${file} carries coursework language: ${pattern}`);
    });
    // The fictional-brand disclosure is not coursework framing and stays.
    assert.match(text, /fictional/i, `${file} still says the brand is fictional`);
  });

  // The documentation is still reachable — the two pages link to each other.
  DOCS.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const others = DOCS.filter((d) => d !== file);
    others.forEach((other) => {
      assert.match(html, new RegExp('href="' + other.replace('.', '\\.') + '"'),
        `${file} should link ${other} so the documentation stays reachable`);
    });
  });
});

test('the brand mark is on every page and stays light enough to ship', () => {
  const htmlFilesAll = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

  htmlFilesAll.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    // Header brand mark, on all eight pages.
    assert.match(html, /<img class="brand__mark" src="assets\/img\/zo-logo-mark\.webp"/,
      `${file} carries the header brand mark`);
    // Decorative: the wordmark beside it already says the name, so a described
    // image would make a screen reader announce the brand twice.
    const mark = html.match(/<img class="brand__mark"[^>]*>/)[0];
    assert.match(mark, /\salt=""/, `${file}: the header mark is decorative`);
    assert.match(mark, /width="\d+"[^>]*height="\d+"/, `${file}: the mark declares its size`);
    // Favicon is a real file rather than an inline SVG.
    assert.match(html, /<link rel="icon" type="image\/png" href="assets\/img\/zo-favicon\.png">/,
      `${file} points at the favicon file`);
  });

  // The emblem appears once, on the home page, where it has room to read.
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const emblems = [...home.matchAll(/zo-logo-emblem\.webp/g)];
  assert.equal(emblems.length, 1, 'the full emblem is used once');
  const emblem = home.match(/<img class="brandband__emblem"[^>]*>/s)[0];
  // This one is content, not decoration, so it describes the crest.
  assert.ok(/alt="[^"]{60,}"/.test(emblem), 'the emblem carries descriptive alternative text');

  // Every brand file exists and is small enough for an offline-first site.
  const BUDGET = { 'zo-logo-mark.webp': 40, 'zo-logo-emblem.webp': 160, 'zo-favicon.png': 16 };
  Object.entries(BUDGET).forEach(([name, maxKb]) => {
    const p = path.join(ROOT, 'assets/img', name);
    assert.ok(fs.existsSync(p), `${name} exists`);
    const kb = fs.statSync(p).size / 1024;
    assert.ok(kb <= maxKb, `${name} is ${kb.toFixed(0)}KB, budget is ${maxKb}KB`);
  });

  // The supplied lockup had "ZO HOTEL & & RESORT" baked in. The wordmark is
  // typeset instead, so the ampersand is ours and there is exactly one.
  assert.match(home, /<h2 class="brandband__name"[^>]*>ZO Hotel &amp; Resort<\/h2>/,
    'the wordmark is typeset, with one ampersand');
  assert.doesNotMatch(home, /&amp;\s*&amp;/, 'no doubled ampersand reaches the page');
});

test('the accessibility promise is one a guest can act on', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const booking = fs.readFileSync(path.join(ROOT, 'booking.html'), 'utf8');

  assert.match(home, /id="accessibility"/, 'the home page has an accessibility section');

  // The section tells a guest to add an accessible room to their booking, so
  // that has to be a request the booking form actually offers. A promise with
  // no control behind it is the badge this section exists to avoid.
  assert.ok(L.REQUESTS.accessible, 'an accessible room is a request in the rate card');
  assert.match(booking, /id="req-accessible"[^>]*value="accessible"/,
    'the booking form offers it');

  // First in the object, so it is first in every UI built from L.REQUESTS.
  assert.equal(Object.keys(L.REQUESTS)[0], 'accessible',
    'the accessible room leads the request group');

  // Concrete, because "wheelchair friendly" gives a guest nothing to plan on.
  const text = visibleText(home);
  ['step-free', 'lift', 'grab rail', 'roll-in shower', 'doorway']
    .forEach((term) => {
      assert.ok(new RegExp(term, 'i').test(text),
        `the section names something specific: expected "${term}"`);
    });

  // And it does not pretend a checklist covers everyone.
  assert.match(text, /call/i, 'the section offers a human to talk to');
  assert.match(home, /href="tel:\+912240001234"/, 'with a real number to call');

  // Confirmation in writing, on the same two-hour promise the requests carry.
  assert.match(text, /in writing within two hours/,
    'requests are confirmed in writing, as everywhere else on the site');

  /* The disclosure is the part worth protecting. A guest who meets a step on
     arrival has been failed twice: by the building, and by the page that did
     not mention it. If somebody later tidies this away for looking negative,
     this fails. */
  assert.match(home, /What is not step-free/,
    'the section names what is not accessible, not only what is');
  ['garden villas', 'stepped path', 'pool hoist'].forEach((gap) => {
    assert.ok(new RegExp(gap, 'i').test(text), `the disclosure names the gap: ${gap}`);
  });
  // And it stays honest rather than burying the gap in a positive frame.
  assert.doesNotMatch(text, /fully accessible|accessible to all|no barriers/i,
    'no blanket accessibility claim, given the gaps just listed');
});

test('the three travelling parties are offered something real', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const booking = fs.readFileSync(path.join(ROOT, 'booking.html'), 'utf8');
  assert.match(home, /id="everyone"/, 'the home page addresses who is travelling');

  const section = home.slice(home.indexOf('id="everyone"'),
    home.indexOf('</section>', home.indexOf('id="everyone"')));
  const text = visibleText(section).replace(/\s+/g, ' ');

  // Each card names a party and offers it something concrete.
  ['With children', 'With older parents', 'With a disability'].forEach((who) => {
    assert.ok(text.includes(who), `a card for travelling ${who.toLowerCase()}`);
  });

  /* A lower floor near the lift helps an older guest and a wheelchair user for
     the same reason, so it is a shared request rather than filed under one
     label — and it has to exist for either card to be telling the truth. */
  assert.ok(L.REQUESTS.lowerFloor, 'a lower floor is a request in the rate card');
  assert.match(booking, /id="req-lowerFloor"[^>]*value="lowerFloor"/,
    'the booking form offers it');

  // Facts carried over from the product rather than invented alongside it.
  assert.match(text, /sleeps four/i, 'the family room capacity matches the rate card');
  assert.equal(L.ROOMS.family.sleeps, 4, 'and the rate card agrees');
  assert.match(text, /₹900 a night/, 'the cot price matches the extra-bed request');
  assert.match(text, /6:00 am to 9:00 pm/, 'the pool hours match the experience section');
  assert.match(text, /9:00 am/, 'early check-in matches the request note');

  // The disability card sends a guest to the detail rather than summarising it.
  assert.match(section, /href="#accessibility"/,
    'the disability card links the detailed section');
});

test('the best rate guarantee promises exactly what the flow delivers', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const flows = fs.readFileSync(path.join(ROOT, 'assets/js/flows.js'), 'utf8');

  assert.match(home, /id="best-rate"/, 'the home page has a best rate section');
  const text = visibleText(home).replace(/\s+/g, ' ');

  // Each term on the page is a term the price-match dialog actually honours.
  // If either side is edited alone, this fails rather than letting the page
  // over-promise what the product does.
  const TERMS = [
    [/another 10% off/i, /another 10% off/i, '10% below the matched price'],
    [/within 24 hours of booking/i, /within 24 hours of booking/i, 'the 24-hour window'],
    [/within one business day/i, /within one business day/i, 'the checking time'],
    [/public page anyone can open/i, /public page anyone can open/i, 'a publicly visible price']
  ];
  TERMS.forEach(([onPage, inFlow, what]) => {
    assert.match(text, onPage, `the page states ${what}`);
    assert.match(flows, inFlow, `the flow honours ${what}`);
  });

  // The page sends the guest where the claim is actually redeemed.
  assert.match(home, /id="best-rate"[\s\S]*?href="manage\.html"/,
    'the section links the page the price link is sent from');

  // No superlative the product cannot back.
  ['lowest price on the internet', 'cheapest anywhere', 'guaranteed lowest']
    .forEach((claim) => {
      assert.doesNotMatch(text.toLowerCase(), new RegExp(claim),
        `unsupported superlative: ${claim}`);
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
