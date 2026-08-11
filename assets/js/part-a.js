/* =============================================================================
   ZO Hotel — part-a.js
   Drives the live demo on the Part A page. It uses an in-memory booking so the
   grader can open the exit prompt, take any branch, and reset — without
   touching a real booking saved on the manage page.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var ZO = window.ZO;
  var L = window.ZOLogic;
  var $ = ZO.$;
  var icon = ZO.icon;
  var esc = ZO.esc;

  var demo = null;

  function freshBooking() {
    var checkIn = L.addDays(L.todayISO(), 12);
    var checkOut = L.addDays(checkIn, 3);
    var q = L.quote({ roomId: 'city', planId: 'flexible', checkIn: checkIn, checkOut: checkOut, requests: {} });
    return {
      reference: 'ZO-2087-MUM',
      email: 'guest@example.com',
      fullName: 'Demo guest',
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
      cardTail: '4291'
    };
  }

  function renderState() {
    var mount = $('#demo-state');
    if (!mount || !demo) return;
    var plan = L.RATE_PLANS[demo.planId];
    var left = Math.max(0, plan.freeChanges - (demo.changesUsed || 0));
    var picked = Object.keys(demo.requests || {}).filter(function (k) { return demo.requests[k]; });

    mount.innerHTML = '' +
      '<dl class="booking-card__grid" style="margin-bottom:0">' +
      '<div class="dl-item"><dt>Reference</dt><dd>' + esc(demo.reference) + '</dd></div>' +
      '<div class="dl-item"><dt>Room</dt><dd>' + esc(L.ROOMS[demo.roomId].name) + '</dd></div>' +
      '<div class="dl-item"><dt>Dates</dt><dd>' + esc(L.formatDateRange(demo.checkIn, demo.checkOut)) + '</dd></div>' +
      '<div class="dl-item"><dt>Total</dt><dd>' + esc(L.formatINR(demo.total)) + '</dd></div>' +
      '<div class="dl-item"><dt>Free changes left</dt><dd>' + esc(String(left)) + '</dd></div>' +
      '<div class="dl-item"><dt>Status</dt><dd>' +
      (demo.status === 'cancelled' ? 'Cancelled' : 'Confirmed') + '</dd></div>' +
      '<div class="dl-item"><dt>Requests</dt><dd>' +
      esc(picked.length ? picked.map(function (k) { return L.REQUESTS[k].label; }).join(', ') : 'None') +
      '</dd></div>' +
      '</dl>';
  }

  function note(config) {
    ZO.banner($('#demo-result'), {
      tone: config.tone || 'info',
      title: config.title,
      body: config.body,
      dismissible: true
    });
  }

  ZO.ready(function () {
    if (!$('#demo-state')) return;
    demo = freshBooking();

    // Show the prompt's photograph in the spec table without opening a dialog.
    var artPreview = $('#art-preview');
    if (artPreview) artPreview.innerHTML = ZO.Flows.artMarkup('dates');

    ZO.Flows.mount({
      getBooking: function () { return demo; },
      applyChange: function (change) {
        demo.checkIn = change.checkIn;
        demo.checkOut = change.checkOut;
        demo.nights = change.quote.nights;
        demo.total = change.quote.total;
        demo.changesUsed = (demo.changesUsed || 0) + 1;
        renderState();
        ZO.toast('Dates changed');
        note({
          tone: 'success',
          title: 'Dates changed to ' + L.formatDateRange(change.checkIn, change.checkOut),
          body: 'The booking survived. This is the outcome the exit prompt is written to produce: ' +
            'a changed booking instead of a cancelled one.'
        });
      },
      applyRequests: function (picked, meal) {
        demo.requests = picked;
        demo.meal = meal || null;
        renderState();
        ZO.toast('Requests added');
        note({
          tone: 'success',
          title: 'Requests added to the booking',
          body: 'Written confirmation follows within two hours. In the dataset, bookings carrying one ' +
            'special request were cancelled 22% of the time, against 48% with none.'
        });
      },
      applyCancel: function (result) {
        demo.status = 'cancelled';
        demo.refundAmount = result.refund.amount;
        renderState();
        note({
          tone: 'info',
          title: 'Booking cancelled in the demo',
          body: (result.refund.amount > 0
            ? '<strong>' + esc(L.formatINR(result.refund.amount)) + '</strong> would go back to the card ending ' +
              esc(L.cardTail(demo)) + ' in ' + esc(result.refund.refundDays) + '. '
            : 'No refund would apply on this rate. ') +
            'Reason recorded: <strong>' + esc(result.reason || 'not given') + '</strong>. ' +
            'Use <em>Reset the demo</em> to try another branch.'
        });
      },
      onNote: note
    });

    ZO.$$('[data-open-variant]').forEach(function (btn) {
      ZO.on(btn, 'click', function () {
        if (demo.status === 'cancelled') {
          note({
            tone: 'warn',
            title: 'This demo booking is already cancelled',
            body: 'Reset the demo to open the exit prompt again.'
          });
          return;
        }
        ZO.Flows.openExitPrompt(btn.getAttribute('data-open-variant'), btn);
      });
    });

    ZO.on($('[data-reset-demo]'), 'click', function () {
      demo = freshBooking();
      renderState();
      $('#demo-result').innerHTML = '';
      ZO.toast('Demo reset');
    });

    renderState();
  });
})(window, document);
