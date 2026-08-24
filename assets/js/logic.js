/* =============================================================================
   ZO Hotel — logic.js
   Pure business rules: rates, taxes, quotes, validation, refunds, date changes.
   No DOM access, so this file is unit-tested directly in Node (see tests/).
   Loaded as a classic script in the browser (window.ZOLogic) and as a CommonJS
   module in tests. Deliberately dependency-free so the site runs from file://.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ZOLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* --- constants ---------------------------------------------------------- */

  var CHECK_IN_HOUR = 14; // 2:00 pm
  var CHECK_OUT_HOUR = 11; // 11:00 am
  var MAX_NIGHTS = 30;
  var MAX_GUESTS = 8;
  var FREE_CANCEL_HOURS = 24; // flexible rate: free until 24h before check-in
  var SEMIFLEX_FREE_DAYS = 7;

  var PROPERTIES = {
    mumbai: {
      id: 'mumbai',
      name: 'ZO Hotel Mumbai',
      area: 'Marine Lines, South Mumbai',
      code: 'MUM'
    },
    goa: {
      id: 'goa',
      name: 'ZO Hotel Goa',
      area: 'Baga Beach, North Goa',
      code: 'GOA'
    }
  };

  // Nightly tariffs carried over from the current ZO Hotel site.
  var ROOMS = {
    city: {
      id: 'city',
      name: 'City Comfort room',
      base: 6999,
      sleeps: 2,
      properties: ['mumbai'],
      blurb: 'King bed, blackout curtains, desk, 40 sq m'
    },
    business: {
      id: 'business',
      name: 'Business room',
      base: 8499,
      sleeps: 2,
      properties: ['mumbai'],
      blurb: 'Work desk, ergonomic chair, 200 Mbps wired line'
    },
    family: {
      id: 'family',
      name: 'Family room',
      base: 9999,
      sleeps: 4,
      properties: ['mumbai', 'goa'],
      blurb: 'Two queen beds, space for a cot, 55 sq m'
    },
    resort: {
      id: 'resort',
      name: 'Resort view room',
      base: 12499,
      sleeps: 3,
      properties: ['goa'],
      blurb: 'Sea-facing balcony, pool access, 60 sq m'
    }
  };

  /* Rate plans. The cancellation terms here are the product answer to the
     dataset finding that non-refundable bookings cancel 99% of the time. */
  var RATE_PLANS = {
    flexible: {
      id: 'flexible',
      name: 'Flexible',
      multiplier: 1,
      freeChanges: 2,
      refundable: true,
      lateRefundPct: 1,
      changeFee: 750,
      cancelUntil: 'until 24 hours before check-in',
      summary: 'Free cancellation until 24 hours before check-in. Two free date changes.'
    },
    semiflex: {
      id: 'semiflex',
      name: 'Semi-flex',
      multiplier: 0.92,
      freeChanges: 1,
      refundable: true,
      lateRefundPct: 0.5,
      changeFee: 1000,
      cancelUntil: 'until 7 days before check-in',
      summary: 'Free cancellation until 7 days before check-in, then 50% back. One free date change.'
    },
    saver: {
      id: 'saver',
      name: 'Saver',
      multiplier: 0.82,
      freeChanges: 0,
      refundable: false,
      lateRefundPct: 0,
      changeFee: 1000,
      cancelUntil: 'not refundable',
      summary: 'Lowest price. No refund if you cancel. Date changes cost ₹1,000 plus any rate difference.'
    }
  };

  var REQUESTS = {
    /* First in the object, so it is first in every UI built from it. A guest who
       needs an accessible room should not have to scroll past the cot to find
       it, and should not have to telephone while everyone else books online. */
    accessible: { id: 'accessible', label: 'Accessible room', note: 'Step-free, wider doorway, grab rails, roll-in shower' },
    parking: { id: 'parking', label: 'Car parking', note: 'Free, on site' },
    earlyCheckin: { id: 'earlyCheckin', label: 'Early check-in', note: 'From 9:00 am, subject to availability' },
    view: { id: 'view', label: 'Sea or city view', note: 'Confirmed at check-in' },
    extraBed: { id: 'extraBed', label: 'Extra bed or cot', note: '₹900 per night, on request' },
    meal: { id: 'meal', label: 'Meal preference', note: 'Veg, non-veg, or Jain' }
  };

  /* Deterministic sold-out windows, stored as MM-DD so any year behaves the
     same. Documented in README.md so the date-change flow is reproducible. */
  var BLACKOUTS = [
    { property: 'all', from: '12-24', to: '01-01', label: 'the new year period' },
    { property: 'goa', from: '02-14', to: '02-16', label: 'a wedding block in Goa' }
  ];

  /* --- dates ------------------------------------------------------------- */

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** Parse 'yyyy-mm-dd' into a local Date at midnight. Returns null if invalid. */
  function parseISO(value) {
    if (typeof value !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var date = new Date(y, mo - 1, d);
    // Reject rolled-over dates such as 2026-02-31.
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
      return null;
    }
    return date;
  }

  function toISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function todayISO(now) {
    return toISO(startOfDay(now || new Date()));
  }

  function addDays(iso, days) {
    var d = parseISO(iso);
    if (!d) return null;
    d.setDate(d.getDate() + days);
    return toISO(d);
  }

  function nights(checkIn, checkOut) {
    var a = parseISO(checkIn);
    var b = parseISO(checkOut);
    if (!a || !b) return null;
    var ms = b.getTime() - a.getTime();
    var n = Math.round(ms / 86400000);
    return n;
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** '2026-08-14' -> '14 Aug 2026'. Locale-independent on purpose. */
  function formatDate(iso) {
    var d = parseISO(iso);
    if (!d) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /** '2026-08-14' -> '14 Aug'. */
  function formatDateShort(iso) {
    var d = parseISO(iso);
    if (!d) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function formatDateRange(checkIn, checkOut) {
    var a = parseISO(checkIn);
    var b = parseISO(checkOut);
    if (!a || !b) return '';
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      return a.getDate() + '–' + b.getDate() + ' ' + MONTHS[b.getMonth()] + ' ' + b.getFullYear();
    }
    return formatDateShort(checkIn) + ' – ' + formatDate(checkOut);
  }

  /** Local Date for check-in at 2:00 pm — the moment the stay begins. */
  function checkInMoment(iso) {
    var d = parseISO(iso);
    if (!d) return null;
    d.setHours(CHECK_IN_HOUR, 0, 0, 0);
    return d;
  }

  function hoursUntil(iso, now) {
    var moment = checkInMoment(iso);
    if (!moment) return null;
    return (moment.getTime() - (now || new Date()).getTime()) / 3600000;
  }

  function formatTimeOfDay(hour) {
    var suffix = hour >= 12 ? 'pm' : 'am';
    var h = hour % 12;
    if (h === 0) h = 12;
    return h + ':00 ' + suffix;
  }

  /* --- money ------------------------------------------------------------- */

  /** Indian digit grouping without relying on Intl (consistent under file://). */
  function groupINR(value) {
    var n = Math.round(Math.abs(value));
    var s = String(n);
    if (s.length <= 3) return s;
    var last3 = s.slice(-3);
    var rest = s.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return rest + ',' + last3;
  }

  function formatINR(value) {
    var sign = value < 0 ? '-' : '';
    return sign + '₹' + groupINR(value);
  }

  /** Indian GST on hotel rooms: 12% up to ₹7,500 per night, 18% above. */
  function gstRate(nightlyRate) {
    return nightlyRate > 7500 ? 0.18 : 0.12;
  }

  /* --- quoting ----------------------------------------------------------- */

  function nightlyRate(roomId, planId) {
    var room = ROOMS[roomId];
    var plan = RATE_PLANS[planId];
    if (!room || !plan) return null;
    return Math.round(room.base * plan.multiplier);
  }

  function extraBedCost(requests, nightCount) {
    return requests && requests.extraBed ? 900 * nightCount : 0;
  }

  /**
   * Full price breakdown for a stay.
   * @returns {null|{nights:number,nightly:number,roomTotal:number,extras:number,
   *   taxRate:number,tax:number,total:number,perNightDisplay:string}}
   */
  function quote(input) {
    var n = nights(input.checkIn, input.checkOut);
    var rate = nightlyRate(input.roomId, input.planId);
    if (n === null || n < 1 || rate === null) return null;
    var roomTotal = rate * n;
    var extras = extraBedCost(input.requests, n);
    var taxRate = gstRate(rate);
    var taxable = roomTotal + extras;
    var tax = Math.round(taxable * taxRate);
    return {
      nights: n,
      nightly: rate,
      roomTotal: roomTotal,
      extras: extras,
      taxRate: taxRate,
      tax: tax,
      total: taxable + tax
    };
  }

  /* --- availability ------------------------------------------------------ */

  function monthDay(iso) {
    return iso.slice(5);
  }

  function inWindow(md, from, to) {
    // Handles windows that wrap across the new year (12-24 -> 01-01).
    if (from <= to) return md >= from && md <= to;
    return md >= from || md <= to;
  }

  /**
   * Deterministic availability check across every night of the stay.
   * @returns {{available:boolean, reason:string, label:string}}
   */
  function checkAvailability(propertyId, checkIn, checkOut) {
    var n = nights(checkIn, checkOut);
    if (n === null || n < 1) {
      return { available: false, reason: 'invalid', label: '' };
    }
    for (var i = 0; i < n; i++) {
      var iso = addDays(checkIn, i);
      var md = monthDay(iso);
      for (var j = 0; j < BLACKOUTS.length; j++) {
        var b = BLACKOUTS[j];
        if (b.property !== 'all' && b.property !== propertyId) continue;
        if (inWindow(md, b.from, b.to)) {
          return { available: false, reason: 'soldout', label: b.label };
        }
      }
    }
    return { available: true, reason: 'ok', label: '' };
  }

  /* --- validation -------------------------------------------------------- */
  /* Error copy follows the Zoho UI Best Practices guide: plain language, states
     the issue and the fix, never accusatory, no exclamation points. Periods
     only on complex or multi-sentence messages. */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var PHONE_RE = /^[6-9]\d{9}$/;

  function normalisePhone(value) {
    return String(value || '').replace(/[\s\-()]/g, '').replace(/^(\+91|0091|91|0)/, '');
  }

  /**
   * Validate the booking form.
   * @param {object} v  raw field values
   * @param {Date} now  injected for testability
   * @returns {{valid:boolean, errors:Object<string,string>}}
   */
  function validateBooking(v, now) {
    var errors = {};
    var today = startOfDay(now || new Date());
    var todayIso = toISO(today);

    // Dates
    var inDate = parseISO(v.checkIn);
    var outDate = parseISO(v.checkOut);

    if (!v.checkIn) {
      errors.checkIn = 'Please enter a check-in date';
    } else if (!inDate) {
      errors.checkIn = 'Please enter the check-in date as dd/mm/yyyy';
    } else if (v.checkIn < todayIso) {
      errors.checkIn = 'Check-in cannot be in the past. Pick today or a later date.';
    }

    if (!v.checkOut) {
      errors.checkOut = 'Please enter a check-out date';
    } else if (!outDate) {
      errors.checkOut = 'Please enter the check-out date as dd/mm/yyyy';
    } else if (inDate && !errors.checkIn) {
      var n = nights(v.checkIn, v.checkOut);
      if (n <= 0) {
        errors.checkOut = 'Check-out must be at least one night after check-in';
      } else if (n > MAX_NIGHTS) {
        errors.checkOut = 'We can book up to ' + MAX_NIGHTS + ' nights online. For a longer stay, call +91 22 4000 1234.';
      }
    }

    // Guests
    var guests = Number(v.guests);
    if (v.guests === '' || v.guests === null || typeof v.guests === 'undefined') {
      errors.guests = 'Please enter the number of guests';
    } else if (!/^\d+$/.test(String(v.guests).trim()) || guests < 1) {
      errors.guests = 'Please enter the number of guests as a whole number, 1 or more';
    } else if (guests > MAX_GUESTS) {
      errors.guests = 'We can book up to ' + MAX_GUESTS + ' guests in one reservation. For a larger group, use the group hold form.';
    }

    // Property and room
    if (!v.property || !PROPERTIES[v.property]) {
      errors.property = 'Please choose a property';
    }
    if (!v.roomId || !ROOMS[v.roomId]) {
      errors.roomId = 'Please choose a room type';
    } else if (v.property && PROPERTIES[v.property]) {
      var room = ROOMS[v.roomId];
      if (room.properties.indexOf(v.property) === -1) {
        errors.roomId = 'The ' + room.name + ' is not at ' + PROPERTIES[v.property].name + '. Pick another room or change the property.';
      } else if (!errors.guests && guests > room.sleeps) {
        errors.roomId = 'The ' + room.name + ' sleeps ' + room.sleeps + '. Pick a larger room or reduce the number of guests.';
      }
    }

    // Rate plan
    if (!v.planId || !RATE_PLANS[v.planId]) {
      errors.planId = 'Please choose a rate';
    }

    // Guest details
    if (!v.fullName || !String(v.fullName).trim()) {
      errors.fullName = 'Please enter the name of the lead guest';
    } else if (String(v.fullName).trim().length < 2) {
      errors.fullName = 'Please enter the full name of the lead guest';
    }

    if (!v.email || !String(v.email).trim()) {
      errors.email = 'Please enter an email address';
    } else if (!EMAIL_RE.test(String(v.email).trim())) {
      errors.email = 'Please enter an email address in the format name@example.com';
    }

    if (!v.phone || !String(v.phone).trim()) {
      errors.phone = 'Please enter a mobile number';
    } else if (!PHONE_RE.test(normalisePhone(v.phone))) {
      errors.phone = 'Please enter a 10-digit Indian mobile number, starting with 6, 7, 8, or 9.';
    }

    if (!v.consent) {
      errors.consent = 'Please confirm you have read the cancellation policy';
    }

    // Availability is a system-side check, so it apologises.
    if (!errors.checkIn && !errors.checkOut && !errors.property) {
      var avail = checkAvailability(v.property, v.checkIn, v.checkOut);
      if (!avail.available && avail.reason === 'soldout') {
        errors.checkOut = 'Sorry, we are sold out over ' + avail.label + '. Try different dates or the other property.';
      }
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /** Validate the manage-booking lookup form. */
  function validateLookup(v) {
    var errors = {};
    var ref = String(v.reference || '').trim().toUpperCase();
    if (!ref) {
      errors.reference = 'Please enter your booking reference';
    } else if (!/^ZO-\d{4}-[A-Z]{3}$/.test(ref)) {
      errors.reference = 'Please enter the reference in the format ZO-1234-MUM';
    }
    if (!v.email || !String(v.email).trim()) {
      errors.email = 'Please enter the email address on the booking';
    } else if (!EMAIL_RE.test(String(v.email).trim())) {
      errors.email = 'Please enter an email address in the format name@example.com';
    }
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* --- refunds ----------------------------------------------------------- */

  /**
   * What the guest gets back if they cancel right now.
   * @returns {{pct:number, amount:number, tier:string, headline:string,
   *   deadline:string, hoursLeft:number, days:number}}
   */
  function refundQuote(booking, now) {
    var plan = RATE_PLANS[booking.planId] || RATE_PLANS.flexible;
    var total = booking.total;
    var hoursLeft = hoursUntil(booking.checkIn, now);
    var days = hoursLeft / 24;
    var pct = 0;
    var tier = 'none';

    if (!plan.refundable) {
      pct = 0;
      tier = 'nonrefundable';
    } else if (plan.id === 'flexible') {
      if (hoursLeft >= FREE_CANCEL_HOURS) {
        pct = 1;
        tier = 'full';
      } else if (hoursLeft > 0) {
        pct = 0;
        tier = 'late';
      } else {
        pct = 0;
        tier = 'started';
      }
    } else {
      // Semi-flex
      if (days >= SEMIFLEX_FREE_DAYS) {
        pct = 1;
        tier = 'full';
      } else if (hoursLeft > 0) {
        pct = plan.lateRefundPct;
        tier = 'partial';
      } else {
        pct = 0;
        tier = 'started';
      }
    }

    var amount = Math.round(total * pct);
    var deadline = '';
    if (plan.id === 'flexible') {
      deadline = formatDate(addDays(booking.checkIn, -1)) + ', ' + formatTimeOfDay(CHECK_IN_HOUR);
    } else if (plan.id === 'semiflex') {
      deadline = formatDate(addDays(booking.checkIn, -SEMIFLEX_FREE_DAYS)) + ', ' + formatTimeOfDay(CHECK_IN_HOUR);
    }

    var headline;
    if (tier === 'full') {
      headline = 'Full refund of ' + formatINR(amount);
    } else if (tier === 'partial') {
      headline = 'Partial refund of ' + formatINR(amount) + ' (50%)';
    } else if (tier === 'nonrefundable') {
      headline = 'No refund on the Saver rate';
    } else if (tier === 'late') {
      headline = 'No refund inside 24 hours of check-in';
    } else {
      headline = 'No refund once the stay has started';
    }

    return {
      pct: pct,
      amount: amount,
      tier: tier,
      headline: headline,
      deadline: deadline,
      hoursLeft: hoursLeft,
      days: days,
      refundDays: '5–7 business days'
    };
  }

  /* --- date changes ------------------------------------------------------ */

  /**
   * Price and validate a date change. Returns errors keyed by field so the
   * dialog can render them inline.
   */
  function changeQuote(booking, newCheckIn, newCheckOut, now) {
    var errors = {};
    var plan = RATE_PLANS[booking.planId] || RATE_PLANS.flexible;
    var today = toISO(startOfDay(now || new Date()));
    var inDate = parseISO(newCheckIn);
    var outDate = parseISO(newCheckOut);

    if (!newCheckIn) {
      errors.checkIn = 'Please enter a new check-in date';
    } else if (!inDate) {
      errors.checkIn = 'Please enter the check-in date as dd/mm/yyyy';
    } else if (newCheckIn < today) {
      errors.checkIn = 'Check-in cannot be in the past. Pick today or a later date.';
    }

    if (!newCheckOut) {
      errors.checkOut = 'Please enter a new check-out date';
    } else if (!outDate) {
      errors.checkOut = 'Please enter the check-out date as dd/mm/yyyy';
    } else if (inDate && !errors.checkIn) {
      var n = nights(newCheckIn, newCheckOut);
      if (n <= 0) {
        errors.checkOut = 'Check-out must be at least one night after check-in';
      } else if (n > MAX_NIGHTS) {
        errors.checkOut = 'We can book up to ' + MAX_NIGHTS + ' nights online. For a longer stay, call +91 22 4000 1234.';
      }
    }

    if (!errors.checkIn && !errors.checkOut &&
        newCheckIn === booking.checkIn && newCheckOut === booking.checkOut) {
      errors.checkIn = 'These are the dates you already have. Pick at least one new date.';
    }

    var availability = { available: true, reason: 'ok', label: '' };
    if (!errors.checkIn && !errors.checkOut) {
      availability = checkAvailability(booking.property, newCheckIn, newCheckOut);
    }

    var changesUsed = booking.changesUsed || 0;
    var freeLeft = Math.max(0, plan.freeChanges - changesUsed);
    var fee = freeLeft > 0 ? 0 : plan.changeFee;

    var newQuote = null;
    var difference = 0;
    if (!errors.checkIn && !errors.checkOut) {
      newQuote = quote({
        roomId: booking.roomId,
        planId: booking.planId,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        requests: booking.requests
      });
      if (newQuote) difference = newQuote.total - booking.total;
    }

    return {
      valid: Object.keys(errors).length === 0 && availability.available,
      errors: errors,
      availability: availability,
      fee: fee,
      freeChangesLeft: freeLeft,
      freeChangesAfter: Math.max(0, freeLeft - 1),
      newQuote: newQuote,
      difference: difference,
      payable: Math.max(0, difference) + fee,
      refundable: Math.max(0, -difference)
    };
  }

  /* --- references and masking ------------------------------------------- */

  /** Deterministic-ish 4-digit reference: ZO-4193-MUM. */
  function bookingRef(propertyId, seed) {
    var code = (PROPERTIES[propertyId] || PROPERTIES.mumbai).code;
    var n = typeof seed === 'number' ? seed : Math.floor(Math.random() * 9000) + 1000;
    n = Math.abs(Math.floor(n)) % 9000 + 1000;
    return 'ZO-' + n + '-' + code;
  }

  function refundRef(bookingReference) {
    var digits = String(bookingReference || '').replace(/\D/g, '') || '0000';
    return 'RF-' + digits.slice(0, 4) + '-' + digits.slice(-4);
  }

  /** 'guest@example.com' -> 'g•••t@example.com' for on-screen confirmations. */
  function maskEmail(email) {
    var s = String(email || '');
    var at = s.indexOf('@');
    if (at < 1) return s;
    var name = s.slice(0, at);
    var domain = s.slice(at);
    if (name.length <= 2) return name.charAt(0) + '•••' + domain;
    return name.charAt(0) + '•••' + name.charAt(name.length - 1) + domain;
  }

  /** Last four digits of a card, for refund copy. */
  function cardTail(booking) {
    return (booking && booking.cardTail) || '4291';
  }

  /* --- exports ----------------------------------------------------------- */

  return {
    CHECK_IN_HOUR: CHECK_IN_HOUR,
    CHECK_OUT_HOUR: CHECK_OUT_HOUR,
    MAX_NIGHTS: MAX_NIGHTS,
    MAX_GUESTS: MAX_GUESTS,
    FREE_CANCEL_HOURS: FREE_CANCEL_HOURS,
    PROPERTIES: PROPERTIES,
    ROOMS: ROOMS,
    RATE_PLANS: RATE_PLANS,
    REQUESTS: REQUESTS,
    BLACKOUTS: BLACKOUTS,
    parseISO: parseISO,
    toISO: toISO,
    todayISO: todayISO,
    addDays: addDays,
    nights: nights,
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    formatDateRange: formatDateRange,
    formatTimeOfDay: formatTimeOfDay,
    hoursUntil: hoursUntil,
    checkInMoment: checkInMoment,
    formatINR: formatINR,
    gstRate: gstRate,
    nightlyRate: nightlyRate,
    quote: quote,
    checkAvailability: checkAvailability,
    validateBooking: validateBooking,
    validateLookup: validateLookup,
    normalisePhone: normalisePhone,
    refundQuote: refundQuote,
    changeQuote: changeQuote,
    bookingRef: bookingRef,
    refundRef: refundRef,
    maskEmail: maskEmail,
    cardTail: cardTail
  };
});
