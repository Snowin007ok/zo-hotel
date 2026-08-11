/* =============================================================================
   ZO Hotel — manage.js
   Manage-booking page: look up a booking, render it, and drive the retention
   flows in flows.js (exit prompt, reason, confirm, date change, requests).
   State lives in localStorage so a booking made on booking.html carries over.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var ZO = window.ZO;
  var L = window.ZOLogic;
  var $ = ZO.$;
  var icon = ZO.icon;
  var esc = ZO.esc;

  var STORE_KEY = 'zo.bookings';
  var LAST_KEY = 'zo.lastRef';
  var DEMO_REF = 'ZO-4193-MUM';
  var DEMO_EMAIL = 'guest@example.com';

  var current = null;

  /* --- storage ----------------------------------------------------------- */

  function all() {
    var list = ZO.store.get(STORE_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function save(booking) {
    var list = all().filter(function (b) { return b.reference !== booking.reference; });
    list.push(booking);
    ZO.store.set(STORE_KEY, list);
    ZO.store.set(LAST_KEY, booking.reference);
  }

  function find(reference, email) {
    var ref = String(reference || '').trim().toUpperCase();
    var mail = String(email || '').trim().toLowerCase();
    return all().filter(function (b) {
      return b.reference === ref && (!mail || String(b.email).toLowerCase() === mail);
    })[0] || null;
  }

  function makeDemoBooking() {
    var checkIn = L.addDays(L.todayISO(), 12);
    var checkOut = L.addDays(checkIn, 3);
    var q = L.quote({ roomId: 'city', planId: 'flexible', checkIn: checkIn, checkOut: checkOut, requests: {} });
    return {
      reference: DEMO_REF,
      email: DEMO_EMAIL,
      fullName: 'Demo guest',
      phone: '9876543210',
      property: 'mumbai',
      roomId: 'city',
      planId: 'flexible',
      checkIn: checkIn,
      checkOut: checkOut,
      guests: 2,
      requests: {},
      meal: null,
      nights: q.nights,
      nightly: q.nightly,
      total: q.total,
      tax: q.tax,
      changesUsed: 0,
      status: 'confirmed',
      cardTail: '4291',
      createdAt: new Date().toISOString()
    };
  }

  /* --- rendering --------------------------------------------------------- */

  function dl(label, value) {
    return '<div class="dl-item"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function requestChips(booking) {
    var picked = Object.keys(booking.requests || {}).filter(function (key) {
      return booking.requests[key];
    });
    if (!picked.length) {
      return '<p class="small muted" style="margin:0">' +
        'No requests on this booking yet. Add one and we will confirm it in writing within two hours.</p>';
    }
    return '<div class="chip-row">' + picked.map(function (key) {
      var r = L.REQUESTS[key];
      var label = r ? r.label : key;
      if (key === 'meal' && booking.meal) {
        label += ': ' + (booking.meal === 'nonveg' ? 'non-vegetarian' : booking.meal === 'jain' ? 'Jain' : 'vegetarian');
      }
      return '<span class="chip chip--success">' + icon('check', 14) + ' ' + esc(label) + '</span>';
    }).join('') + '</div>';
  }

  function refundLine(booking) {
    var refund = L.refundQuote(booking, new Date());
    var plan = L.RATE_PLANS[booking.planId];
    if (refund.tier === 'full') {
      return '<strong>' + esc(refund.headline) + '</strong> if you cancel before ' +
        esc(refund.deadline) + '. Money reaches the card ending ' + esc(L.cardTail(booking)) +
        ' in ' + esc(refund.refundDays) + '.';
    }
    if (refund.tier === 'partial') {
      return '<strong>' + esc(refund.headline) + '</strong> from here on. The free window on the ' +
        esc(plan.name) + ' rate closed on ' + esc(refund.deadline) + '.';
    }
    if (refund.tier === 'nonrefundable') {
      return '<strong>Not refundable.</strong> The Saver rate returns nothing on cancellation, ' +
        'but you can still move the dates for ' + esc(L.formatINR(plan.changeFee)) + ' plus any rate difference.';
    }
    if (refund.tier === 'late') {
      return '<strong>Inside 24 hours of check-in.</strong> Cancelling now returns nothing. ' +
        'Moving the dates still costs nothing.';
    }
    return '<strong>This stay has started.</strong> Talk to the front desk on +91 22 4000 1234.';
  }

  function changesLine(booking) {
    var plan = L.RATE_PLANS[booking.planId];
    var left = Math.max(0, plan.freeChanges - (booking.changesUsed || 0));
    if (left > 0) {
      return left === 1 ? 'One free date change left' : left + ' free date changes left';
    }
    return 'No free changes left · ' + L.formatINR(plan.changeFee) + ' plus any rate difference';
  }

  function renderBooking() {
    var mount = $('#booking-mount');
    var lookupCard = $('#lookup-card');
    if (!current) {
      mount.innerHTML = '';
      if (lookupCard) lookupCard.hidden = false;
      renderEmptyState();
      return;
    }

    if (lookupCard) lookupCard.hidden = true;
    $('#empty-mount').innerHTML = '';

    var b = current;
    var cancelled = b.status === 'cancelled';
    var room = L.ROOMS[b.roomId];
    var property = L.PROPERTIES[b.property];
    var plan = L.RATE_PLANS[b.planId];

    var actions = cancelled
      ? '<a class="btn btn--primary" href="' + esc('booking.html') + '">Book these dates again</a>' +
        '<button type="button" class="btn btn--outline" data-switch>Look up another booking</button>'
      : '<button type="button" class="btn btn--primary" data-action="dates">' + icon('calendarSwap', 18) + ' Change dates</button>' +
        '<button type="button" class="btn btn--outline" data-action="requests">' + icon('sparkle', 18) + ' Add a request</button>' +
        '<button type="button" class="btn btn--quiet-danger" data-action="cancel">Cancel booking</button>';

    mount.innerHTML = '' +
      '<div class="booking-card' + (cancelled ? ' booking-card--cancelled' : '') + '">' +
      '<div class="booking-card__head">' +
      '<div>' +
      '<h2 style="margin:0 0 .15rem;font-size:1.3rem">' + esc(room.name) + '</h2>' +
      '<p class="booking-card__ref">Reference <strong>' + esc(b.reference) + '</strong> · ' + esc(b.email) + '</p>' +
      '</div>' +
      (cancelled
        ? '<span class="chip chip--danger">Cancelled</span>'
        : '<span class="chip chip--success">' + icon('check', 14) + ' Confirmed</span>') +
      '</div>' +
      '<div class="booking-card__body">' +
      '<dl class="booking-card__grid">' +
      dl('Property', property.name) +
      dl('Dates', L.formatDateRange(b.checkIn, b.checkOut)) +
      dl('Nights', String(L.nights(b.checkIn, b.checkOut))) +
      dl('Guests', String(b.guests)) +
      dl('Rate', plan.name) +
      dl(cancelled ? 'Was' : 'Total paid', L.formatINR(b.total)) +
      '</dl>' +
      (cancelled
        ? '<div class="summary__policy">' +
          (b.refundAmount > 0
            ? '<strong>' + esc(L.formatINR(b.refundAmount)) + ' refunded</strong> to the card ending ' +
              esc(L.cardTail(b)) + '. Refund reference ' + esc(b.refundRef) + ', paid in 5–7 business days.'
            : 'No refund applied on this rate. Refund reference ' + esc(b.refundRef) + ' is on file if anything changes.') +
          '</div>'
        : '<div class="summary__policy">' + refundLine(b) + '</div>' +
          '<div class="mt-3"><p class="label" style="margin-bottom:.4rem">Requests on this stay</p>' +
          requestChips(b) + '</div>' +
          '<p class="tiny muted mt-2">' + icon('calendarSwap', 14) + ' ' + esc(changesLine(b)) + '</p>') +
      '</div>' +
      '<div class="booking-card__actions">' + actions + '</div>' +
      '</div>';

    wireCardActions();
  }

  function renderEmptyState() {
    /* Educate first, then offer the next action. No CTA-shaped heading. */
    $('#empty-mount').innerHTML = '' +
      '<div class="empty-state">' +
      '<span style="color:var(--teal)">' + icon('inbox', 44) + '</span>' +
      '<h2>No booking loaded yet</h2>' +
      '<p>Enter the reference from your confirmation email above and the booking appears here, ' +
      'with everything you can do to it: move the dates, add a request, or cancel.</p>' +
      '<div class="btn-row" style="justify-content:center;margin-top:1.25rem">' +
      '<button type="button" class="btn btn--primary" data-demo>Load the demo booking</button>' +
      '<a class="btn btn--outline" href="booking.html">Book a stay</a>' +
      '</div>' +
      '<p class="tiny muted" style="margin-top:1rem">The demo booking is ' + esc(DEMO_REF) +
      ' with ' + esc(DEMO_EMAIL) + ', checking in 12 days from today.</p>' +
      '</div>';

    ZO.on($('[data-demo]'), 'click', function () {
      var demo = find(DEMO_REF, DEMO_EMAIL) || makeDemoBooking();
      save(demo);
      current = demo;
      ZO.banner($('#page-alert'), {
        tone: 'info',
        title: 'Demo booking loaded',
        body: 'This is a Flexible rate booking, so free cancellation and two free date changes apply. ' +
          'Use <strong>Cancel booking</strong> to see the exit prompt.',
        dismissible: true
      });
      renderBooking();
    });
  }

  function wireCardActions() {
    var mount = $('#booking-mount');

    ZO.$$('[data-action]', mount).forEach(function (btn) {
      ZO.on(btn, 'click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'dates') ZO.Flows.openDates(btn);
        if (action === 'requests') ZO.Flows.openRequests(btn);
        /* The exit prompt is the first thing a cancellation attempt hits. */
        if (action === 'cancel') ZO.Flows.openExitPrompt('dates', btn);
      });
    });

    ZO.$$('[data-switch]', mount).forEach(function (btn) {
      ZO.on(btn, 'click', function () {
        current = null;
        $('#page-alert').innerHTML = '';
        renderBooking();
        var input = $('#reference');
        if (input) input.focus();
      });
    });
  }

  /* --- flow callbacks ---------------------------------------------------- */

  function applyChange(change) {
    var previous = change.previous;
    current.checkIn = change.checkIn;
    current.checkOut = change.checkOut;
    current.nights = change.quote.nights;
    current.nightly = change.quote.nightly;
    current.total = change.quote.total;
    current.tax = change.quote.tax;
    current.changesUsed = (current.changesUsed || 0) + 1;
    save(current);
    renderBooking();

    var detail;
    if (change.difference > 0) {
      detail = L.formatINR(change.difference + change.fee) + ' due on the new dates';
    } else if (change.difference < 0) {
      detail = L.formatINR(-change.difference) + ' comes back to you';
    } else {
      detail = 'Nothing more to pay';
    }

    ZO.banner($('#page-alert'), {
      tone: 'success',
      title: 'Dates changed to ' + L.formatDateRange(change.checkIn, change.checkOut),
      body: detail + '. We have emailed the updated confirmation to ' + esc(L.maskEmail(current.email)) + '.',
      dismissible: true
    });

    /* One action on a success alert, and it is the useful one: undo. */
    ZO.toast('Dates changed', {
      actionLabel: 'Undo',
      onAction: function () {
        current.checkIn = previous.checkIn;
        current.checkOut = previous.checkOut;
        current.total = previous.total;
        current.nights = previous.nights;
        current.changesUsed = previous.changesUsed;
        save(current);
        renderBooking();
        ZO.banner($('#page-alert'), {
          tone: 'info',
          title: 'Dates restored to ' + L.formatDateRange(previous.checkIn, previous.checkOut),
          body: 'Nothing was charged, and your free date changes are back where they were.',
          dismissible: true
        });
      }
    });
  }

  function applyRequests(picked, meal) {
    current.requests = picked;
    current.meal = meal || null;
    save(current);
    renderBooking();
    ZO.toast('Requests added');
    ZO.banner($('#page-alert'), {
      tone: 'info',
      title: 'We are confirming your requests',
      body: 'Written confirmation reaches ' + esc(L.maskEmail(current.email)) +
        ' within two hours. Parking is always free at both properties.',
      dismissible: true
    });
  }

  function applyCancel(result) {
    current.status = 'cancelled';
    current.cancelledAt = new Date().toISOString();
    current.refundAmount = result.refund.amount;
    current.refundRef = L.refundRef(current.reference);
    current.cancelReason = result.reason;
    current.cancelNote = result.reasonNote;
    save(current);
    renderBooking();

    /* Critical information, so it goes in a persistent banner rather than a
       toast that disappears after a few seconds. */
    var body = result.refund.amount > 0
      ? '<strong>' + esc(L.formatINR(result.refund.amount)) + '</strong> is on its way to the card ending ' +
        esc(L.cardTail(current)) + ', in ' + esc(result.refund.refundDays) + '. ' +
        'Refund reference <span class="mono">' + esc(current.refundRef) + '</span>. ' +
        'We have emailed the details to ' + esc(L.maskEmail(current.email)) + '.'
      : 'No refund applies on this rate, so nothing comes back. Reference <span class="mono">' +
        esc(current.refundRef) + '</span> is on file, and the room is released. ' +
        'We have emailed the details to ' + esc(L.maskEmail(current.email)) + '.';

    ZO.banner($('#page-alert'), {
      tone: 'info',
      title: 'Booking cancelled',
      body: body,
      actions: [{
        label: 'Book these dates again',
        variant: 'btn--primary',
        onClick: function () { window.location.href = 'booking.html'; }
      }]
    });

    var alertBox = $('#page-alert');
    if (alertBox) {
      alertBox.setAttribute('tabindex', '-1');
      alertBox.focus();
    }
  }

  /* --- boot -------------------------------------------------------------- */

  ZO.ready(function () {
    if (!$('#booking-mount')) return;

    ZO.Flows.mount({
      getBooking: function () { return current; },
      applyChange: applyChange,
      applyRequests: applyRequests,
      applyCancel: applyCancel,
      onNote: function (note) {
        ZO.banner($('#page-alert'), {
          tone: note.tone || 'info',
          title: note.title,
          body: note.body,
          dismissible: true
        });
      }
    });

    /* Lookup form */
    var lookupForm = $('#lookup-form');
    ZO.Form.bind(lookupForm, {
      validate: function (data) { return L.validateLookup(data); },
      onValid: function (data) {
        var found = find(data.reference, data.email);
        if (!found) {
          /* A guest typing an unknown reference is not an error we apologise
             for: state what happened and offer the way forward. */
          ZO.banner($('#page-alert'), {
            tone: 'error',
            title: 'No booking matches those details',
            body: 'Check the reference against your confirmation email, including the letters at the end. ' +
              'You can also load the demo booking below, or call +91 22 4000 1234.',
            dismissible: true
          });
          var input = $('#reference');
          if (input) input.focus();
          return;
        }
        current = found;
        $('#page-alert').innerHTML = '';
        renderBooking();
      }
    });

    /* Deep link from the booking confirmation: ?ref=...&email=... */
    var params = new window.URLSearchParams(window.location.search);
    var ref = params.get('ref');
    var email = params.get('email');
    if (ref) {
      var found = find(ref, email || '');
      if (found) {
        current = found;
      } else {
        $('#reference').value = ref;
        if (email) $('#email').value = email;
        ZO.banner($('#page-alert'), {
          tone: 'warn',
          title: 'That booking is not on this device',
          body: 'Bookings in this demo are stored in your browser only. Make a booking first, or load the demo booking below.',
          dismissible: true
        });
      }
    } else {
      var last = ZO.store.get(LAST_KEY, null);
      if (last) current = find(last, '');
    }

    renderBooking();
  });
})(window, document);
