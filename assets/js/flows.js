/* =============================================================================
   ZO Hotel — flows.js
   Every retention and self-service flow, in one place so the copy has a single
   source of truth and both manage.html and part-a-exit-prompt.html render the
   identical component:

     1. Exit prompt      (Part A deliverable — shown when a guest starts to cancel)
     2. Reason step      (collects the cancellation reason, offers a fix)
     3. Confirm step     (irreversible action, escalating friction)
     4. Change dates     (the alternative the exit prompt pushes toward)
     5. Add requests     (bookings with no request attached cancelled more often)
     6. Price match      (third-party bookings cancelled more often than direct)

   Copy follows the Zoho UI Best Practices guide: sentence case, no exclamation
   points, the same action verb in header/description/CTA, no "Are you sure",
   and the affirmative (safe) action on the right.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var ZO = window.ZO || {};
  window.ZO = ZO;
  var L = window.ZOLogic;
  var $ = ZO.$;
  var $$ = ZO.$$;
  var icon = ZO.icon;
  var esc = ZO.esc;

  /* Real photography. Each is used in a wide strip no larger than its own
     pixel dimensions, so nothing is upscaled. */
  var ART = {
    dates: {
      src: 'assets/img/pool.jpg',
      width: 1900,
      height: 750,
      alt: 'The palm-lined pool at ZO in the afternoon, loungers and parasols along its edge.'
    },
    price: {
      src: 'assets/img/hero-goa..jpg',
      width: 1200,
      height: 943,
      alt: 'ZO Hotel Mumbai lit warmly at dusk, its facade reflected in the courtyard pool.'
    },
    requests: {
      src: 'assets/img/goa-resort.jpg',
      width: 1846,
      height: 1230,
      alt: 'The ZO Hotel Goa resort above a curved beach, with cabanas, a pool and the Arabian Sea beyond.'
    }
  };

  /** Photograph for a dialog header. */
  function artMarkup(key) {
    var art = ART[key] || ART.dates;
    return '<img src="' + art.src + '" alt="' + esc(art.alt) + '" width="' + art.width +
      '" height="' + art.height + '" decoding="async">';
  }

  /* --- copy -------------------------------------------------------------- */

  /* Each variant answers one cancellation reason found in the booking data.
     `insight` is shown on the Part A page, not in the live dialog. */
  var VARIANTS = {
    dates: {
      id: 'dates',
      art: 'dates',
      reasonLabel: 'My dates changed',
      insight: 'Bookings changed once were cancelled 14% of the time, against 41% for bookings nobody touched. The pattern suggests offering a date change may help preserve the booking when plans move.',
      /* Header, description and primary CTA all carry the verb "change". */
      headline: 'Change your dates instead?',
      message: 'Change your dates and keep your booking.',
      primary: { label: 'Change my dates', action: 'dates' }
    },
    price: {
      id: 'price',
      art: 'price',
      reasonLabel: 'I found a lower price',
      insight: 'Bookings made through third-party travel sites were cancelled 41% of the time, against 17% booked direct. The data does not record why, so price matching answers the pattern rather than a proven cause.',
      /* Verb: "send". */
      headline: 'Send us the lower price instead?',
      message: 'Send us the link and you may not need to cancel at all. If the same room and dates are publicly listed for less, we match that price and take another 10% off it, checked within one business day.',
      primary: { label: 'Send the price link', action: 'price' }
    },
    requests: {
      id: 'requests',
      art: 'requests',
      reasonLabel: 'My requests are not confirmed',
      insight: 'Bookings with no special request attached were cancelled 48% of the time, against 22% for bookings carrying one special request. The data records the request, not whether anyone confirmed it, so confirming in writing is the ZO response to that pattern.',
      /* Verb: "confirm". */
      headline: 'Confirm your requests instead?',
      message: 'Confirm what you need — parking, a cot, a view, a Jain meal — and we put it in writing within two hours.',
      primary: { label: 'Confirm my requests', action: 'requests' }
    }
  };

  /* Reasons offered in step 2, drawn from the same dataset findings. */
  var REASONS = [
    { id: 'dates', label: 'My dates changed', offer: 'dates', offerCta: 'Move my dates', offerTitle: 'You can move these dates with no change fee', offerBody: 'Pick new dates and we will re-price the nights. You keep your room type where it is available, and see any price difference before confirming.' },
    { id: 'price', label: 'I found a lower price', offer: 'price', offerCta: 'Send the price link', offerTitle: 'We will match a lower public price', offerBody: 'Send the link within 24 hours of booking. We match the rate and take another 10% off it.' },
    { id: 'requests', label: 'My requests are not confirmed', offer: 'requests', offerCta: 'Confirm my requests', offerTitle: 'We can confirm your requests now', offerBody: 'Add parking, a cot, a view, or a meal preference. You get written confirmation within two hours.' },
    { id: 'refund', label: 'I am not sure how the refund works', offer: 'refund', offerCta: 'See the refund detail', offerTitle: 'Here is exactly what comes back', offerBody: '' },
    { id: 'trip', label: 'The trip is off', offer: null },
    { id: 'other', label: 'Something else', offer: null }
  ];

  /* --- controller state -------------------------------------------------- */

  var ctrl = {
    getBooking: function () { return null; },
    applyChange: function () {},
    applyRequests: function () {},
    applyCancel: function () {},
    onNote: null
  };

  var state = {
    reason: null,
    reasonNote: '',
    lastChange: null,
    mounted: false
  };

  function booking() {
    return ctrl.getBooking();
  }

  function plan(b) {
    return L.RATE_PLANS[b.planId] || L.RATE_PLANS.flexible;
  }

  function room(b) {
    return L.ROOMS[b.roomId] || L.ROOMS.city;
  }

  function property(b) {
    return L.PROPERTIES[b.property] || L.PROPERTIES.mumbai;
  }

  function freeChangesLeft(b) {
    return Math.max(0, plan(b).freeChanges - (b.changesUsed || 0));
  }

  /* --- markup ------------------------------------------------------------ */

  function dialogShell(id, options) {
    var o = options || {};
    return '' +
      '<div class="dialog-backdrop" id="' + id + '" hidden>' +
      '<div class="dialog' + (o.wide ? ' dialog--wide' : '') + '" role="dialog" aria-modal="true" ' +
      'aria-labelledby="' + id + '-title" aria-describedby="' + id + '-desc">' +
      '<button type="button" class="dialog__close" data-dialog-close aria-label="' + esc(o.closeLabel || 'Close this dialog') + '">' +
      icon('close', 18) + '</button>' +
      (o.art ? '<div class="dialog__art" data-slot="art"></div>' : '') +
      '<div class="dialog__body">' + o.body + '</div>' +
      '</div></div>';
  }

  function exitPromptMarkup() {
    return dialogShell('dlg-exit', {
      art: true,
      wide: true,
      closeLabel: 'Close and keep this booking',
      body: '' +
        /* Two choices only: continue cancelling, or take the alternative.
           Closing the dialog (X, Escape, backdrop) keeps the booking. */
        '<h2 class="dialog__title" id="dlg-exit-title" data-slot="headline"></h2>' +
        '<p class="dialog__lede" id="dlg-exit-desc" data-slot="message"></p>' +
        '<p class="summary__policy" data-slot="consequence"></p>' +
        '<div class="dialog__actions dialog__actions--retention">' +
        '<button type="button" class="btn btn--quiet-danger" data-exit-cancel>Continue cancellation</button>' +
        '<button type="button" class="btn btn--primary" data-exit-primary data-autofocus></button>' +
        '</div>'
    });
  }

  function reasonMarkup() {
    var options = REASONS.map(function (r, i) {
      return '' +
        '<label class="option" for="reason-' + r.id + '">' +
        '<input type="radio" name="reason" id="reason-' + r.id + '" value="' + r.id + '"' + (i === 0 ? ' data-autofocus' : '') + '>' +
        '<span class="option__text"><span class="option__title">' + esc(r.label) + '</span></span>' +
        '</label>';
    }).join('');

    return dialogShell('dlg-reason', {
      closeLabel: 'Close and keep this booking',
      body: '' +
        '<p class="dialog__steps"><span aria-current="step">Step 1 of 2</span></p>' +
        '<h2 class="dialog__title" id="dlg-reason-title">Tell us why you are cancelling</h2>' +
        /* The reason is optional. Asking is worth it, because a reason with a
           fix behind it is how a guest finds the date change instead of losing
           the booking — but a guest who wants out should not have to answer a
           question first, so cancelling stays reachable in one click either
           way. */
        '<p class="dialog__lede" id="dlg-reason-desc">If a reason fits, we may be able to fix it instead. Answering is optional.</p>' +
        '<form novalidate data-reason-form>' +
        '<fieldset>' +
        '<legend class="visually-hidden">Reason for cancelling, optional</legend>' +
        '<div class="option-list">' + options + '</div>' +
        '</fieldset>' +
        '<div class="field mt-2" data-slot="noteField" hidden>' +
        '<label class="label" for="reason-note">What happened? <span class="muted" style="font-weight:400">(optional)</span></label>' +
        '<textarea class="textarea" id="reason-note" name="reasonNote" rows="3"></textarea>' +
        '</div>' +
        '<div class="banner banner--info mt-3" data-slot="offer" role="status" hidden>' +
        '<span class="banner__icon">' + icon('sparkle', 22) + '</span>' +
        '<div class="banner__body">' +
        '<p class="banner__title" data-slot="offerTitle"></p>' +
        '<p data-slot="offerBody"></p>' +
        '</div></div>' +
        '<div class="dialog__actions dialog__actions--retention">' +
        /* Reads as a skip while nothing is chosen, and as continuing once a
           reason is. Either way it is the quiet action and Keep booking is the
           filled one. */
        '<button type="button" class="btn btn--quiet-danger" data-reason-continue>Skip to cancellation review</button>' +
        '<button type="button" class="btn btn--primary" data-dialog-close data-reason-keep>Keep booking</button>' +
        '<button type="submit" class="btn btn--primary" data-reason-offer hidden></button>' +
        '</div>' +
        '</form>'
    });
  }

  function confirmMarkup() {
    return dialogShell('dlg-cancel', {
      closeLabel: 'Close and keep this booking',
      body: '' +
        '<p class="dialog__steps"><span aria-current="step">Step 2 of 2</span></p>' +
        '<h2 class="dialog__title" id="dlg-cancel-title" data-slot="title"></h2>' +
        '<p class="dialog__lede" id="dlg-cancel-desc" data-slot="desc"></p>' +
        '<form novalidate data-confirm-form>' +
        '<div class="field mt-3" data-slot="forceField" hidden>' +
        '<label class="label" for="confirm-word">Type <strong>CANCEL</strong> to confirm</label>' +
        '<p class="hint" id="confirm-word-hint">This booking is not refundable, so we ask you to type it out.</p>' +
        '<input class="input" id="confirm-word" name="confirmWord" type="text" autocomplete="off" ' +
        'aria-describedby="confirm-word-hint" style="max-width:220px">' +
        '<p class="error-text" data-error-for="confirmWord" hidden></p>' +
        /* Says out loud why the destructive button is unavailable, and when
           it becomes available. Read by AT on focus and on change. */
        '<p class="hint" id="confirm-force-status" data-slot="forceStatus" aria-live="polite"></p>' +
        '</div>' +
        '<div class="dialog__actions dialog__actions--retention">' +
        '<button type="submit" class="btn btn--quiet-danger" data-confirm-cancel>Cancel booking</button>' +
        '<button type="button" class="btn btn--primary" data-dialog-close data-confirm-keep data-autofocus>Keep booking</button>' +
        '</div>' +
        '</form>' +
        '<p class="dialog__foot">Cancelling cannot be undone. You can always book these dates again at the price available then.</p>'
    });
  }

  function datesMarkup() {
    return dialogShell('dlg-dates', {
      closeLabel: 'Close without changing the dates',
      body: '' +
        '<h2 class="dialog__title" id="dlg-dates-title">Change your dates</h2>' +
        '<p class="dialog__lede" id="dlg-dates-desc">Pick new dates. You keep your room type where it is available, and see any price difference before confirming.</p>' +
        '<div data-slot="alert" aria-live="polite"></div>' +
        '<form novalidate data-dates-form>' +
        '<div class="error-summary" data-error-summary hidden></div>' +
        '<p class="small muted" data-slot="current"></p>' +
        '<div class="form-grid mt-2">' +
        '<div class="field">' +
        '<label class="label" for="new-checkin">New check-in <span class="req" aria-hidden="true">*</span></label>' +
        '<p class="hint" id="new-checkin-hint">Check-in from 2:00 pm</p>' +
        '<input class="input" type="date" id="new-checkin" name="checkIn" aria-describedby="new-checkin-hint" required>' +
        '<p class="error-text" data-error-for="checkIn" hidden></p>' +
        '</div>' +
        '<div class="field">' +
        '<label class="label" for="new-checkout">New check-out <span class="req" aria-hidden="true">*</span></label>' +
        '<p class="hint" id="new-checkout-hint">Check-out by 11:00 am</p>' +
        '<input class="input" type="date" id="new-checkout" name="checkOut" aria-describedby="new-checkout-hint" required>' +
        '<p class="error-text" data-error-for="checkOut" hidden></p>' +
        '</div>' +
        '</div>' +
        '<div class="summary__policy mt-3" data-slot="quote" aria-live="polite"></div>' +
        '<div class="dialog__actions">' +
        '<button type="button" class="btn btn--outline" data-dialog-close>Keep current dates</button>' +
        '<button type="submit" class="btn btn--primary">Change dates</button>' +
        '</div>' +
        '</form>'
    });
  }

  function requestsMarkup() {
    var boxes = Object.keys(L.REQUESTS).map(function (key) {
      var r = L.REQUESTS[key];
      return '' +
        '<label class="option" for="req-' + r.id + '">' +
        '<input type="checkbox" name="requests" id="req-' + r.id + '" value="' + r.id + '" data-group="true">' +
        '<span class="option__text"><span class="option__title">' + esc(r.label) + '</span>' +
        '<span class="option__note">' + esc(r.note) + '</span></span>' +
        '</label>';
    }).join('');

    return dialogShell('dlg-requests', {
      closeLabel: 'Close without adding requests',
      body: '' +
        '<h2 class="dialog__title" id="dlg-requests-title">Add requests to your stay</h2>' +
        '<p class="dialog__lede" id="dlg-requests-desc">Pick what you need. We reply with written confirmation within two hours.</p>' +
        '<form novalidate data-requests-form>' +
        '<fieldset>' +
        '<legend class="visually-hidden">Stay requests</legend>' +
        '<div class="option-list">' + boxes + '</div>' +
        '</fieldset>' +
        '<div class="field mt-2" data-slot="mealField" hidden>' +
        '<label class="label" for="meal-pref">Meal preference</label>' +
        '<select class="select" id="meal-pref" name="meal">' +
        '<option value="veg">Vegetarian</option>' +
        '<option value="nonveg">Non-vegetarian</option>' +
        '<option value="jain">Jain</option>' +
        '</select>' +
        '</div>' +
        '<p class="error-text" data-error-for="requests" hidden></p>' +
        '<div class="dialog__actions">' +
        '<button type="button" class="btn btn--outline" data-dialog-close>Keep as it is</button>' +
        '<button type="submit" class="btn btn--primary">Add requests</button>' +
        '</div>' +
        '</form>'
    });
  }

  function priceMarkup() {
    return dialogShell('dlg-price', {
      closeLabel: 'Close without sending a link',
      body: '' +
        '<h2 class="dialog__title" id="dlg-price-title">Send us the lower price</h2>' +
        '<p class="dialog__lede" id="dlg-price-desc">Paste the link to the same room and dates listed for less. We check it within one business day, match the rate, and take another 10% off it.</p>' +
        '<form novalidate data-price-form>' +
        '<div class="field">' +
        '<label class="label" for="price-link">Link to the lower price <span class="req" aria-hidden="true">*</span></label>' +
        '<p class="hint" id="price-link-hint">A public page anyone can open, starting with https://</p>' +
        '<input class="input" type="url" id="price-link" name="link" required aria-describedby="price-link-hint" data-autofocus>' +
        '<p class="error-text" data-error-for="link" hidden></p>' +
        '</div>' +
        '<div class="dialog__actions">' +
        '<button type="button" class="btn btn--outline" data-dialog-close>Close</button>' +
        '<button type="submit" class="btn btn--primary">Send the link</button>' +
        '</div>' +
        '</form>'
    });
  }

  /* --- rendering helpers ------------------------------------------------- */

  function slot(rootId, name) {
    return $('#' + rootId + ' [data-slot="' + name + '"]');
  }

  /** How the guest's remaining free changes read as one sentence. */
  function changeSentence(b) {
    var pl = plan(b);
    var left = freeChangesLeft(b);
    if (left === 1) return 'You have one free date change left on your ' + pl.name + ' rate.';
    if (left > 1) return 'You have ' + left + ' free date changes left on your ' + pl.name + ' rate.';
    if (pl.changeFee) return 'A date change on your ' + pl.name + ' rate costs ' + L.formatINR(pl.changeFee) + '.';
    return '';
  }

  /* The description repeats the header's verb, then carries only the facts
     that bear on this decision. Each fact appears once, here and nowhere
     else in the dialog. */
  function exitDescription(variant, b) {
    var text = variant.message;
    if (variant.id === 'dates' && b) {
      var sentence = changeSentence(b);
      if (sentence) text += ' ' + sentence;
      text += ' Any price difference is shown before you confirm.';
    }
    return text;
  }

  /** The one consequence of not taking the alternative, in money. */
  function exitConsequence(b) {
    var refund = L.refundQuote(b, new Date());
    if (refund.pct === 1) return 'Cancel today and the full ' + L.formatINR(b.total) + ' is refundable.';
    if (refund.amount > 0) {
      return 'Cancel today and ' + L.formatINR(refund.amount) + ' of ' + L.formatINR(b.total) + ' is refundable.';
    }
    return 'Cancel today and none of ' + L.formatINR(b.total) + ' is refundable.';
  }

  function renderExitPrompt(variantId) {
    var variant = VARIANTS[variantId] || VARIANTS.dates;
    var b = booking();
    slot('dlg-exit', 'art').innerHTML = artMarkup(variant.art);
    slot('dlg-exit', 'headline').textContent = variant.headline;
    slot('dlg-exit', 'message').textContent = exitDescription(variant, b);

    var consequence = slot('dlg-exit', 'consequence');
    consequence.textContent = b ? exitConsequence(b) : '';
    consequence.hidden = !b;

    var primary = $('#dlg-exit [data-exit-primary]');
    primary.textContent = variant.primary.label;
    primary.dataset.action = variant.primary.action;
  }

  /** True only when cancelling returns the guest nothing at all. */
  function losesEverything(b) {
    var refund = L.refundQuote(b, new Date());
    return refund.amount === 0 && b.total > 0;
  }

  /* Keeps the destructive button's availability, its ARIA state and the
     spoken reason for it in one place. */
  function syncForceState() {
    var b = booking();
    if (!b) return;
    var cancelBtn = $('#dlg-cancel [data-confirm-cancel]');
    var status = slot('dlg-cancel', 'forceStatus');
    var input = $('#confirm-word');
    if (!cancelBtn) return;

    if (!losesEverything(b)) {
      cancelBtn.removeAttribute('aria-disabled');
      cancelBtn.removeAttribute('aria-describedby');
      if (status) status.textContent = '';
      return;
    }

    var matched = ((input && input.value) || '').trim().toUpperCase() === 'CANCEL';
    cancelBtn.setAttribute('aria-disabled', matched ? 'false' : 'true');
    cancelBtn.setAttribute('aria-describedby', 'confirm-force-status');
    if (status) {
      status.textContent = matched
        ? 'CANCEL typed. Cancel booking is now available.'
        : 'Cancel booking is unavailable until you type CANCEL above.';
    }
  }

  function renderConfirm() {
    var b = booking();
    var refund = L.refundQuote(b, new Date());
    var pl = plan(b);
    var p = property(b);
    var range = L.formatDateRange(b.checkIn, b.checkOut);
    var needsForce = losesEverything(b);

    /* Header, description and destructive CTA all carry the verb "cancel".
       The description holds the refund and the room, and nothing else. */
    var title = needsForce ? 'Cancel non-refundable booking?' : 'Cancel booking?';
    var desc;
    if (needsForce) {
      desc = 'Cancel this ' + pl.name + ' booking? ' + L.formatINR(b.total) +
        ' is non-refundable and the room will be released. Type CANCEL below to continue.';
    } else {
      desc = 'Cancel your ' + p.name + ' booking for ' + range + '? ' +
        L.formatINR(refund.amount) + ' will be refunded to your original payment method. ' +
        'The room will be released after cancellation.';
    }

    slot('dlg-cancel', 'title').textContent = title;
    slot('dlg-cancel', 'desc').textContent = desc;

    /* Forcing function: only when the guest loses the whole amount. The guide
       reserves this level of friction for actions that cannot be undone. */
    var forceField = slot('dlg-cancel', 'forceField');
    var input = $('#confirm-word');
    forceField.hidden = !needsForce;
    input.value = '';
    input.required = needsForce;
    ZO.Form.clearError($('#dlg-cancel'), 'confirmWord');
    syncForceState();
  }

  function renderDatesDialog() {
    var b = booking();
    var pl = plan(b);
    var left = freeChangesLeft(b);
    var today = L.todayISO();

    slot('dlg-dates', 'current').innerHTML = 'Currently ' + esc(L.formatDateRange(b.checkIn, b.checkOut)) +
      ' · ' + esc(String(L.nights(b.checkIn, b.checkOut))) + ' nights · ' +
      esc(left > 0 ? (left === 1 ? 'one free change left' : left + ' free changes left')
        : 'no free changes left on the ' + pl.name + ' rate');

    var inEl = $('#new-checkin');
    var outEl = $('#new-checkout');
    inEl.min = today;
    outEl.min = today;
    inEl.value = b.checkIn;
    outEl.value = b.checkOut;

    slot('dlg-dates', 'alert').innerHTML = '';
    ZO.Form.clearAll($('#dlg-dates'));
    updateDatesQuote();
  }

  function updateDatesQuote() {
    var b = booking();
    var target = slot('dlg-dates', 'quote');
    if (!b || !target) return;
    var newIn = $('#new-checkin').value;
    var newOut = $('#new-checkout').value;
    var result = L.changeQuote(b, newIn, newOut, new Date());

    /* On opening, both fields hold the dates the guest already has, so say that
       rather than asking them to pick dates that are visibly already there. */
    if (newIn === b.checkIn && newOut === b.checkOut) {
      target.innerHTML = '<span class="muted">These are your current dates. Change either one and the new price appears here.</span>';
      return;
    }

    if (!result.newQuote) {
      target.innerHTML = '<span class="muted">Pick both dates to see the new price.</span>';
      return;
    }

    var rows = [
      ['New stay', L.formatDateRange(newIn, newOut) + ' · ' + result.newQuote.nights +
        (result.newQuote.nights === 1 ? ' night' : ' nights')],
      ['New total', L.formatINR(result.newQuote.total)],
      ['Change fee', result.fee === 0 ? 'None' : L.formatINR(result.fee)]
    ];

    if (result.difference > 0) {
      rows.push(['To pay now', L.formatINR(result.difference + result.fee)]);
    } else if (result.difference < 0) {
      rows.push(['Back to you', L.formatINR(-result.difference)]);
    } else if (result.fee === 0) {
      rows.push(['To pay now', 'Nothing']);
    }

    if (!result.availability.available && result.availability.reason === 'soldout') {
      rows.push(['Availability', 'Sold out over ' + result.availability.label]);
    }

    target.innerHTML = rows.map(function (row) {
      return '<div class="summary__line" style="padding:.15rem 0"><span>' + esc(row[0]) +
        '</span><strong>' + esc(row[1]) + '</strong></div>';
    }).join('') +
      '<p class="tiny muted" style="margin-top:.5rem">Free changes left after this one: ' +
      esc(String(result.freeChangesAfter)) + '</p>';
  }

  function renderRequestsDialog() {
    var b = booking();
    var current = b.requests || {};
    $$('#dlg-requests input[name="requests"]').forEach(function (box) {
      box.checked = !!current[box.value];
    });
    var meal = $('#meal-pref');
    if (meal && b.meal) meal.value = b.meal;
    slot('dlg-requests', 'mealField').hidden = !current.meal;
    ZO.Form.clearError($('#dlg-requests'), 'requests');
  }

  /* --- step wiring -------------------------------------------------------- */

  function goToReason(returnFocus) {
    state.reason = null;
    state.reasonNote = '';
    var form = $('[data-reason-form]');
    if (form) form.reset();
    slot('dlg-reason', 'offer').hidden = true;
    slot('dlg-reason', 'noteField').hidden = true;
    $('#dlg-reason [data-reason-offer]').hidden = true;
    /* Reopening starts with nothing chosen, so the quiet action goes back to
       offering the skip and Keep booking goes back to being the filled one. */
    var reopenContinue = $('#dlg-reason [data-reason-continue]');
    if (reopenContinue) reopenContinue.textContent = 'Skip to cancellation review';
    var reopenKeep = $('#dlg-reason [data-reason-keep]');
    if (reopenKeep) reopenKeep.className = 'btn btn--primary';
    ZO.Form.clearError($('#dlg-reason'), 'reason');
    ZO.Dialog.replace('dlg-reason', { returnFocus: returnFocus });
  }

  function goToConfirm(returnFocus) {
    renderConfirm();
    ZO.Dialog.replace('dlg-cancel', { returnFocus: returnFocus });
  }

  function openDates(returnFocus) {
    renderDatesDialog();
    ZO.Dialog.replace('dlg-dates', { returnFocus: returnFocus, initialFocus: '#new-checkin' });
  }

  function openRequests(returnFocus) {
    renderRequestsDialog();
    ZO.Dialog.replace('dlg-requests', { returnFocus: returnFocus });
  }

  function openPrice(returnFocus) {
    var form = $('[data-price-form]');
    if (form) form.reset();
    ZO.Form.clearError($('#dlg-price'), 'link');
    ZO.Dialog.replace('dlg-price', { returnFocus: returnFocus });
  }

  function runOffer(offer, returnFocus) {
    if (offer === 'dates') return openDates(returnFocus);
    if (offer === 'requests') return openRequests(returnFocus);
    if (offer === 'price') return openPrice(returnFocus);
    if (offer === 'refund') return goToConfirm(returnFocus);
    return goToConfirm(returnFocus);
  }

  function wire() {
    /* Step 1: exit prompt */
    ZO.on($('#dlg-exit [data-exit-primary]'), 'click', function (event) {
      runOffer(event.currentTarget.dataset.action, null);
    });
    ZO.on($('#dlg-exit [data-exit-cancel]'), 'click', function () {
      goToReason(null);
    });

    /* Step 2: reason */
    var reasonForm = $('[data-reason-form]');
    ZO.on(reasonForm, 'change', function (event) {
      if (event.target.name !== 'reason') return;
      var reason = REASONS.filter(function (r) { return r.id === event.target.value; })[0];
      state.reason = reason ? reason.id : null;
      ZO.Form.clearError($('#dlg-reason'), 'reason');

      slot('dlg-reason', 'noteField').hidden = !reason || reason.id !== 'other';

      var offerBox = slot('dlg-reason', 'offer');
      var offerBtn = $('#dlg-reason [data-reason-offer]');
      var keepBtn = $('#dlg-reason [data-reason-keep]');
      var continueBtn = $('#dlg-reason [data-reason-continue]');

      /* Once something is chosen there is nothing left to skip, so the quiet
         action stops calling itself a skip and names what it does. */
      if (continueBtn) {
        continueBtn.textContent = state.reason ? 'Continue cancellation' : 'Skip to cancellation review';
      }

      if (reason && reason.offer) {
        var body = reason.offerBody;
        if (reason.offer === 'refund') {
          var refund = L.refundQuote(booking(), new Date());
          body = refund.headline + '. Money reaches the card ending ' + L.cardTail(booking()) +
            ' in ' + refund.refundDays + ', and we email a refund reference the moment it leaves us.';
        }
        slot('dlg-reason', 'offerTitle').textContent = reason.offerTitle;
        slot('dlg-reason', 'offerBody').textContent = body;
        offerBox.hidden = false;
        offerBtn.hidden = false;
        offerBtn.textContent = reason.offerCta;
        offerBtn.dataset.offer = reason.offer;
        /* The fix becomes the one filled button; keeping steps down a level. */
        keepBtn.className = 'btn btn--outline';
      } else {
        offerBox.hidden = true;
        offerBtn.hidden = true;
        keepBtn.className = 'btn btn--primary';
      }
    });

    ZO.on(reasonForm, 'submit', function (event) {
      event.preventDefault();
      var offerBtn = $('#dlg-reason [data-reason-offer]');
      if (offerBtn.hidden) return;
      runOffer(offerBtn.dataset.offer, null);
    });

    /* No gate. A guest who will not answer still gets to the review in one
       click, and the cancellation records a null reason rather than a
       reluctant guess. */
    ZO.on($('#dlg-reason [data-reason-continue]'), 'click', function () {
      var note = $('#reason-note');
      state.reasonNote = note ? note.value.trim() : '';
      goToConfirm(null);
    });

    /* Step 3: confirm */
    var confirmForm = $('[data-confirm-form]');

    /* Typing the word is what releases the destructive button, so the button's
       state and its spoken reason follow every keystroke. */
    ZO.on($('#confirm-word'), 'input', function () {
      ZO.Form.clearError($('#dlg-cancel'), 'confirmWord');
      syncForceState();
    });

    ZO.on(confirmForm, 'submit', function (event) {
      event.preventDefault();
      var b = booking();
      var refund = L.refundQuote(b, new Date());
      var needsForce = losesEverything(b);

      if (needsForce) {
        var typed = ($('#confirm-word').value || '').trim().toUpperCase();
        if (typed !== 'CANCEL') {
          ZO.Form.setError($('#dlg-cancel'), 'confirmWord', 'Please type CANCEL to confirm, in capitals or lower case');
          syncForceState();
          $('#confirm-word').focus();
          return;
        }
      }

      ZO.Dialog.closeAll();
      ctrl.applyCancel({
        refund: refund,
        reason: state.reason,
        reasonNote: state.reasonNote
      });
    });

    /* Date change */
    var datesForm = $('[data-dates-form]');
    ZO.on($('#new-checkin'), 'change', function () {
      var b = booking();
      if (!b) return;
      var inVal = $('#new-checkin').value;
      var outEl = $('#new-checkout');
      // Keep check-out after check-in as the guest moves the start date, and
      // hold the original length of stay.
      if (inVal && (!outEl.value || outEl.value <= inVal)) {
        outEl.value = L.addDays(inVal, Math.max(1, L.nights(b.checkIn, b.checkOut) || 1));
      }
      outEl.min = inVal ? L.addDays(inVal, 1) : L.todayISO();
      updateDatesQuote();
    });
    ZO.on($('#new-checkout'), 'change', updateDatesQuote);
    ZO.on($('#new-checkin'), 'input', updateDatesQuote);
    ZO.on($('#new-checkout'), 'input', updateDatesQuote);

    ZO.on(datesForm, 'submit', function (event) {
      event.preventDefault();
      var b = booking();
      var newIn = $('#new-checkin').value;
      var newOut = $('#new-checkout').value;
      var result = L.changeQuote(b, newIn, newOut, new Date());

      ZO.Form.clearAll($('#dlg-dates'));
      slot('dlg-dates', 'alert').innerHTML = '';

      var errors = result.errors;
      if (Object.keys(errors).length) {
        Object.keys(errors).forEach(function (name) {
          ZO.Form.setError($('#dlg-dates'), name, errors[name]);
        });
        ZO.Form.renderSummary($('#dlg-dates'), errors, { focus: false });
        var firstControl = ZO.Form.controlFor($('#dlg-dates'), Object.keys(errors)[0]);
        if (firstControl) firstControl.focus();
        return;
      }

      if (!result.availability.available) {
        /* System-side failure: persistent, apologetic, and offers a way out. */
        ZO.banner(slot('dlg-dates', 'alert'), {
          tone: 'error',
          title: 'Those dates are sold out',
          body: 'Sorry, we are fully booked over ' + esc(result.availability.label) +
            '. Try dates on either side, or call +91 22 4000 1234 and we will look at the other property with you.'
        });
        $('#new-checkin').focus();
        return;
      }

      var previous = { checkIn: b.checkIn, checkOut: b.checkOut, changesUsed: b.changesUsed || 0, total: b.total, nights: b.nights };
      state.lastChange = previous;

      ZO.Dialog.closeAll();
      ctrl.applyChange({
        checkIn: newIn,
        checkOut: newOut,
        quote: result.newQuote,
        fee: result.fee,
        difference: result.difference,
        previous: previous
      });
    });

    /* Requests */
    var requestsForm = $('[data-requests-form]');
    ZO.on(requestsForm, 'change', function (event) {
      if (event.target.value === 'meal') {
        slot('dlg-requests', 'mealField').hidden = !event.target.checked;
      }
      ZO.Form.clearError($('#dlg-requests'), 'requests');
    });

    ZO.on(requestsForm, 'submit', function (event) {
      event.preventDefault();
      var picked = {};
      var any = false;
      $$('#dlg-requests input[name="requests"]').forEach(function (box) {
        picked[box.value] = box.checked;
        if (box.checked) any = true;
      });
      if (!any) {
        ZO.Form.setError($('#dlg-requests'), 'requests', 'Please pick at least one request, or close this dialog to keep the booking as it is');
        var firstBox = $('#dlg-requests input[name="requests"]');
        if (firstBox) firstBox.focus();
        return;
      }
      var meal = $('#meal-pref');
      ZO.Dialog.closeAll();
      ctrl.applyRequests(picked, picked.meal && meal ? meal.value : null);
    });

    /* Price match */
    var priceForm = $('[data-price-form]');
    ZO.on(priceForm, 'submit', function (event) {
      event.preventDefault();
      var field = $('#price-link');
      var value = (field.value || '').trim();
      if (!value) {
        ZO.Form.setError($('#dlg-price'), 'link', 'Please paste the link to the lower price');
        field.focus();
        return;
      }
      if (!/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(value)) {
        ZO.Form.setError($('#dlg-price'), 'link', 'Please paste a full web address, starting with https://');
        field.focus();
        return;
      }
      ZO.Form.clearError($('#dlg-price'), 'link');
      ZO.Dialog.closeAll();
      ZO.toast('Price link sent');
      if (ctrl.onNote) {
        ctrl.onNote({
          tone: 'info',
          title: 'We are checking that price',
          body: 'We compare the link against the same room and dates, then email you within one business day. Your booking stays exactly as it is until then.'
        });
      }
    });
  }

  /* --- public API --------------------------------------------------------- */

  function mount(options) {
    var opts = options || {};
    if (opts.getBooking) ctrl.getBooking = opts.getBooking;
    if (opts.applyChange) ctrl.applyChange = opts.applyChange;
    if (opts.applyRequests) ctrl.applyRequests = opts.applyRequests;
    if (opts.applyCancel) ctrl.applyCancel = opts.applyCancel;
    if (opts.onNote) ctrl.onNote = opts.onNote;
    if (state.mounted) return;

    var host = document.createElement('div');
    host.setAttribute('data-zo-dialogs', '');
    host.innerHTML = exitPromptMarkup() + reasonMarkup() + confirmMarkup() +
      datesMarkup() + requestsMarkup() + priceMarkup();
    // Dialogs live as direct children of body so the backdrop covers the page
    // and the aria-hidden sweep in dialog.js can reach every sibling.
    while (host.firstChild) document.body.appendChild(host.firstChild);

    state.mounted = true;
    wire();
  }

  ZO.Flows = {
    mount: mount,
    artMarkup: artMarkup,
    VARIANTS: VARIANTS,
    REASONS: REASONS,
    ART: ART,
    openExitPrompt: function (variantId, trigger) {
      if (!booking()) return;
      renderExitPrompt(variantId);
      ZO.Dialog.open('dlg-exit', { returnFocus: trigger || null });
    },
    openDates: function (trigger) {
      if (!booking()) return;
      renderDatesDialog();
      ZO.Dialog.open('dlg-dates', { returnFocus: trigger || null, initialFocus: '#new-checkin' });
    },
    openRequests: function (trigger) {
      if (!booking()) return;
      renderRequestsDialog();
      ZO.Dialog.open('dlg-requests', { returnFocus: trigger || null });
    },
    openPrice: function (trigger) {
      openPrice(trigger || null);
    },
    lastChange: function () { return state.lastChange; },
    clearLastChange: function () { state.lastChange = null; }
  };
})(window, document);
