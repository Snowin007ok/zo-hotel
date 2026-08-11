/* =============================================================================
   ZO Hotel — booking.js
   Booking page: room and rate options built from the rate card, live price
   summary, full client-side validation, and the booking confirmation.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var ZO = window.ZO;
  var L = window.ZOLogic;
  var $ = ZO.$;
  var $$ = ZO.$$;
  var icon = ZO.icon;
  var esc = ZO.esc;

  var STORE_KEY = 'zo.bookings';
  var LAST_KEY = 'zo.lastRef';

  ZO.ready(function () {
    var form = $('#booking-form');
    if (!form) return;

    var propertyEl = $('#property');
    var roomEl = $('#roomId');
    var guestsEl = $('#guests');
    var checkInEl = $('#checkIn');
    var checkOutEl = $('#checkOut');
    var summaryEl = $('#summary-body');
    var policyEl = $('#summary-policy');
    var planList = $('#plan-list');
    var confirmMount = $('#booking-confirmation');
    var formCard = $('#booking-form-card');

    /* --- date bounds ----------------------------------------------------- */
    var today = L.todayISO();
    checkInEl.min = today;
    checkOutEl.min = L.addDays(today, 1);

    /* --- room options follow the chosen property ------------------------- */

    function roomsFor(propertyId) {
      return Object.keys(L.ROOMS)
        .map(function (key) { return L.ROOMS[key]; })
        .filter(function (room) { return room.properties.indexOf(propertyId) !== -1; });
    }

    function syncRooms() {
      var propertyId = propertyEl.value;
      var wanted = roomEl.value;
      var list = roomsFor(propertyId);
      roomEl.innerHTML = list.map(function (room) {
        return '<option value="' + room.id + '">' + esc(room.name) + ' · ' +
          esc(L.formatINR(room.base)) + ' a night · sleeps ' + room.sleeps + '</option>';
      }).join('');
      // Keep the previous room if it exists at this property.
      if (list.some(function (r) { return r.id === wanted; })) roomEl.value = wanted;
      syncPlanPrices();
    }

    /* --- rate plan cards ------------------------------------------------- */

    function syncPlanPrices() {
      var roomId = roomEl.value;
      $$('[data-plan]', planList).forEach(function (card) {
        var planId = card.getAttribute('data-plan');
        var rate = L.nightlyRate(roomId, planId);
        var priceEl = $('[data-plan-price]', card);
        if (priceEl && rate !== null) {
          priceEl.innerHTML = esc(L.formatINR(rate)) + ' <span class="muted" style="font-weight:400">a night</span>';
        }
      });
    }

    /* --- live summary ---------------------------------------------------- */

    function summaryEmptyState() {
      /* Educate, then encourage the next action — the empty-state pattern from
         the UI Best Practices guide. */
      summaryEl.innerHTML = '' +
        '<div class="center" style="padding:.75rem 0">' +
        '<span style="color:var(--teal)">' + icon('calendar', 34) + '</span>' +
        '<h3 style="font-size:1.05rem;margin:.65rem 0 .35rem">No dates picked yet</h3>' +
        '<p class="small muted" style="max-width:30ch;margin:0 auto">' +
        'Your nightly rate, taxes and total appear here as soon as you choose a check-in and check-out date.' +
        '</p></div>';
      policyEl.innerHTML = '<strong>Free cancellation</strong> comes with the Flexible rate, up to 24 hours before check-in.';
    }

    function updateSummary() {
      var data = ZO.Form.values(form);
      var q = L.quote({
        roomId: data.roomId,
        planId: data.planId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        requests: data.requests
      });

      if (!q) {
        summaryEmptyState();
        return;
      }

      var room = L.ROOMS[data.roomId];
      var plan = L.RATE_PLANS[data.planId];
      var propertyName = (L.PROPERTIES[data.property] || {}).name || '';
      var nightWord = q.nights === 1 ? 'night' : 'nights';

      var rows = [
        [esc(L.formatINR(q.nightly)) + ' × ' + q.nights + ' ' + nightWord, L.formatINR(q.roomTotal)]
      ];
      if (q.extras > 0) rows.push(['Extra bed · ' + q.nights + ' ' + nightWord, L.formatINR(q.extras)]);
      rows.push(['GST at ' + Math.round(q.taxRate * 100) + '%', L.formatINR(q.tax)]);

      summaryEl.innerHTML = '' +
        '<p class="small muted" style="margin-bottom:.75rem">' +
        esc(room.name) + ' at ' + esc(propertyName) + '<br>' +
        esc(L.formatDateRange(data.checkIn, data.checkOut)) + ' · ' + esc(plan.name) + ' rate' +
        '</p>' +
        rows.map(function (row) {
          return '<div class="summary__line"><span>' + row[0] + '</span><span>' + esc(row[1]) + '</span></div>';
        }).join('') +
        '<div class="summary__line summary__line--total"><span>Total</span><span>' +
        esc(L.formatINR(q.total)) + '</span></div>' +
        '<p class="tiny muted" style="margin-top:.5rem">Nothing is charged on this demo. Taxes follow the Indian GST slabs for room tariffs.</p>';

      /* The cancellation terms sit next to the price, not buried in a policy
         page — the concern that drives most cancellations gets answered here. */
      var refundLine;
      if (plan.id === 'flexible') {
        refundLine = '<strong>Free cancellation</strong> until ' +
          esc(L.formatDate(L.addDays(data.checkIn, -1))) + ', ' + esc(L.formatTimeOfDay(L.CHECK_IN_HOUR)) +
          '. Two free date changes. Full refund of ' + esc(L.formatINR(q.total)) + ' in 5–7 business days.';
      } else if (plan.id === 'semiflex') {
        refundLine = '<strong>Free cancellation</strong> until ' +
          esc(L.formatDate(L.addDays(data.checkIn, -7))) + ', ' + esc(L.formatTimeOfDay(L.CHECK_IN_HOUR)) +
          '. After that, half of ' + esc(L.formatINR(q.total)) + ' comes back. One free date change.';
      } else {
        refundLine = '<strong>Not refundable.</strong> The Saver rate saves ' +
          esc(L.formatINR(L.quote({ roomId: data.roomId, planId: 'flexible', checkIn: data.checkIn, checkOut: data.checkOut, requests: data.requests }).total - q.total)) +
          ' now, and returns nothing if you cancel. A date change costs ' + esc(L.formatINR(plan.changeFee)) + ' plus any rate difference.';
      }
      policyEl.innerHTML = refundLine;
    }

    /* --- confirmation ---------------------------------------------------- */

    function saveBooking(booking) {
      var all = ZO.store.get(STORE_KEY, []);
      if (!Array.isArray(all)) all = [];
      all = all.filter(function (b) { return b.reference !== booking.reference; });
      all.push(booking);
      ZO.store.set(STORE_KEY, all);
      ZO.store.set(LAST_KEY, booking.reference);
    }

    function showConfirmation(booking) {
      var q = { total: booking.total };
      var refund = L.refundQuote(booking, new Date());
      var manageUrl = 'manage.html?ref=' + encodeURIComponent(booking.reference) +
        '&email=' + encodeURIComponent(booking.email);

      formCard.hidden = true;
      var summaryCard = $('#summary-card');
      if (summaryCard) summaryCard.hidden = true;

      confirmMount.hidden = false;
      confirmMount.innerHTML = '' +
        '<div class="banner banner--success" role="status">' +
        '<span class="banner__icon">' + icon('checkCircle', 24) + '</span>' +
        '<div class="banner__body">' +
        '<p class="banner__title">Booking confirmed</p>' +
        '<p>We have emailed the confirmation and the cancellation terms to ' +
        esc(L.maskEmail(booking.email)) + '.</p>' +
        '</div></div>' +
        '<div class="booking-card">' +
        '<div class="booking-card__head">' +
        '<div><h2 style="margin:0 0 .15rem;font-size:1.25rem">' + esc(L.ROOMS[booking.roomId].name) + '</h2>' +
        '<p class="booking-card__ref">Reference <strong>' + esc(booking.reference) + '</strong></p></div>' +
        '<span class="chip chip--success">' + icon('check', 14) + ' Confirmed</span>' +
        '</div>' +
        '<div class="booking-card__body">' +
        '<div class="booking-card__grid">' +
        dl('Property', L.PROPERTIES[booking.property].name) +
        dl('Dates', L.formatDateRange(booking.checkIn, booking.checkOut)) +
        dl('Nights', String(booking.nights)) +
        dl('Guests', String(booking.guests)) +
        dl('Rate', L.RATE_PLANS[booking.planId].name) +
        dl('Total paid', L.formatINR(q.total)) +
        '</div>' +
        '<div class="summary__policy">' +
        (refund.tier === 'nonrefundable'
          ? 'The Saver rate is not refundable. You can still move the dates for ' + esc(L.formatINR(L.RATE_PLANS.saver.changeFee)) + ' plus any rate difference.'
          : '<strong>' + esc(refund.headline) + '</strong> if you cancel by ' + esc(refund.deadline) + '. Money reaches you in ' + esc(refund.refundDays) + '.') +
        '</div>' +
        '</div>' +
        '<div class="booking-card__actions">' +
        '<a class="btn btn--primary" href="' + esc(manageUrl) + '">Manage this booking</a>' +
        '<a class="btn btn--outline" href="index.html">Back to the ZO Hotel home page</a>' +
        '</div>' +
        '</div>' +
        '<p class="small muted mt-3">Next: the manage page is where you can move the dates, add a request, or cancel. ' +
        'That is also where the exit prompt appears.</p>';

      var heading = $('.banner__title', confirmMount);
      if (heading) {
        confirmMount.setAttribute('tabindex', '-1');
        confirmMount.focus();
      }
      if (confirmMount.scrollIntoView) {
        confirmMount.scrollIntoView({ block: 'start', behavior: ZO.prefersReducedMotion() ? 'auto' : 'smooth' });
      }
      ZO.toast('Booking confirmed');
    }

    function dl(label, value) {
      return '<div class="dl-item"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
    }

    /* --- wiring ---------------------------------------------------------- */

    ZO.on(propertyEl, 'change', function () {
      syncRooms();
      updateSummary();
    });
    ZO.on(roomEl, 'change', function () {
      syncPlanPrices();
      updateSummary();
    });

    ZO.on(checkInEl, 'change', function () {
      var value = checkInEl.value;
      if (value) {
        checkOutEl.min = L.addDays(value, 1);
        if (checkOutEl.value && checkOutEl.value <= value) {
          checkOutEl.value = L.addDays(value, 1);
        }
      }
      updateSummary();
    });

    form.addEventListener('input', updateSummary);
    form.addEventListener('change', updateSummary);

    ZO.Form.bind(form, {
      validate: function (data) {
        return L.validateBooking(data, new Date());
      },
      onValid: function (data) {
        var q = L.quote({
          roomId: data.roomId,
          planId: data.planId,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          requests: data.requests
        });
        var booking = {
          reference: L.bookingRef(data.property),
          email: String(data.email).trim(),
          fullName: String(data.fullName).trim(),
          phone: L.normalisePhone(data.phone),
          property: data.property,
          roomId: data.roomId,
          planId: data.planId,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          guests: Number(data.guests),
          requests: data.requests || {},
          meal: data.meal || null,
          nights: q.nights,
          nightly: q.nightly,
          total: q.total,
          tax: q.tax,
          changesUsed: 0,
          status: 'confirmed',
          cardTail: '4291',
          createdAt: new Date().toISOString()
        };
        saveBooking(booking);
        showConfirmation(booking);
      }
    });

    /* Extra-bed checkbox reveals the meal select in the requests group. */
    ZO.on($('#req-meal-booking'), 'change', function (event) {
      var field = $('#meal-field');
      if (field) field.hidden = !event.target.checked;
    });

    /* Prefill from the home-page search bar, or from a "View room" link. */
    function applyQueryParams() {
      var params = new window.URLSearchParams(window.location.search);

      var property = params.get('property');
      if (property && L.PROPERTIES[property]) propertyEl.value = property;

      // Room options depend on the property, so build them first.
      syncRooms();

      var room = params.get('room');
      if (room && L.ROOMS[room] && $('option[value="' + room + '"]', roomEl)) {
        roomEl.value = room;
        syncPlanPrices();
      }

      var checkIn = params.get('checkIn');
      if (checkIn && L.parseISO(checkIn) && checkIn >= today) {
        checkInEl.value = checkIn;
        checkOutEl.min = L.addDays(checkIn, 1);
      }

      var checkOut = params.get('checkOut');
      if (checkOut && L.parseISO(checkOut) && (!checkInEl.value || checkOut > checkInEl.value)) {
        checkOutEl.value = checkOut;
      }

      var guests = params.get('guests');
      if (guests && /^\d+$/.test(guests) && Number(guests) >= 1 && Number(guests) <= L.MAX_GUESTS) {
        guestsEl.value = guests;
      }
    }

    applyQueryParams();
    updateSummary();
  });
})(window, document);
