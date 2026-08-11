/* =============================================================================
   ZO Hotel — dialog.js
   Accessible modal dialogs: focus trap, Escape to close, focus restored to the
   trigger, background hidden from assistive tech, body scroll locked, and
   step-to-step chaining for the cancellation flow.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var ZO = window.ZO || {};
  window.ZO = ZO;

  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  /** Open dialogs, innermost last. */
  var stack = [];
  var scrollLocked = false;
  var hiddenSiblings = [];

  function focusable(root) {
    return Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE))
      .filter(function (node) {
        if (node.hasAttribute('hidden')) return false;
        if (node.getAttribute('aria-hidden') === 'true') return false;
        // offsetParent is null for display:none subtrees.
        return node.offsetParent !== null || node === document.activeElement;
      });
  }

  function lockScroll() {
    if (scrollLocked) return;
    var barWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.dataset.zoPrevOverflow = document.body.style.overflow || '';
    document.body.dataset.zoPrevPadding = document.body.style.paddingRight || '';
    document.body.style.overflow = 'hidden';
    if (barWidth > 0) document.body.style.paddingRight = barWidth + 'px';
    scrollLocked = true;
  }

  function unlockScroll() {
    if (!scrollLocked) return;
    document.body.style.overflow = document.body.dataset.zoPrevOverflow || '';
    document.body.style.paddingRight = document.body.dataset.zoPrevPadding || '';
    delete document.body.dataset.zoPrevOverflow;
    delete document.body.dataset.zoPrevPadding;
    scrollLocked = false;
  }

  /* Hide everything except the dialog and the live region from screen readers. */
  function hideBackground(backdrop) {
    if (hiddenSiblings.length) return;
    Array.prototype.slice.call(document.body.children).forEach(function (child) {
      if (child === backdrop) return;
      if (child.id === 'toast-region') return;
      if (child.classList && child.classList.contains('dialog-backdrop')) return;
      if (child.getAttribute('aria-hidden') === 'true') return;
      child.setAttribute('aria-hidden', 'true');
      hiddenSiblings.push(child);
    });
  }

  function showBackground() {
    hiddenSiblings.forEach(function (child) { child.removeAttribute('aria-hidden'); });
    hiddenSiblings = [];
  }

  function resolve(target) {
    if (!target) return null;
    return typeof target === 'string' ? document.getElementById(target.replace(/^#/, '')) : target;
  }

  function panel(backdrop) {
    return backdrop.querySelector('.dialog') || backdrop;
  }

  function setInitialFocus(backdrop, initialFocus) {
    var box = panel(backdrop);
    var target = null;
    if (initialFocus) target = resolve(initialFocus);
    if (!target) target = box.querySelector('[data-autofocus]');
    if (!target) {
      var items = focusable(box);
      // Skip the close button when there is anything more useful to land on.
      target = items.filter(function (n) { return !n.classList.contains('dialog__close'); })[0] || items[0];
    }
    if (!target) {
      box.setAttribute('tabindex', '-1');
      target = box;
    }
    // rAF so the element is painted (and focusable) before we focus it.
    window.requestAnimationFrame(function () {
      try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
    });
  }

  function onKeydown(event) {
    if (!stack.length) return;
    var top = stack[stack.length - 1];

    if (event.key === 'Escape') {
      if (top.dismissible) {
        event.preventDefault();
        close(top.backdrop);
      }
      return;
    }

    if (event.key !== 'Tab') return;

    var items = focusable(panel(top.backdrop));
    if (!items.length) {
      event.preventDefault();
      return;
    }
    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

    if (!panel(top.backdrop).contains(active)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Open a dialog.
   * @param {string|HTMLElement} target backdrop element or its id
   * @param {{returnFocus?:HTMLElement, initialFocus?:string|HTMLElement,
   *   dismissible?:boolean, onClose?:Function}} [options]
   */
  function open(target, options) {
    var backdrop = resolve(target);
    if (!backdrop) return null;
    var opts = options || {};

    // Already open: just re-focus.
    if (stack.some(function (entry) { return entry.backdrop === backdrop; })) {
      setInitialFocus(backdrop, opts.initialFocus);
      return backdrop;
    }

    var entry = {
      backdrop: backdrop,
      returnFocus: opts.returnFocus || (document.activeElement instanceof window.HTMLElement ? document.activeElement : null),
      dismissible: opts.dismissible !== false,
      onClose: opts.onClose || null
    };

    // Only the top dialog is visible; anything under it is hidden outright.
    stack.forEach(function (item) { item.backdrop.hidden = true; });

    backdrop.hidden = false;
    stack.push(entry);
    lockScroll();
    hideBackground(backdrop);
    setInitialFocus(backdrop, opts.initialFocus);
    return backdrop;
  }

  /**
   * Close a dialog (defaults to the top one).
   * @param {string|HTMLElement} [target]
   * @param {{restoreFocus?:boolean}} [options]
   */
  function close(target, options) {
    var opts = options || {};
    var backdrop = target ? resolve(target) : (stack.length ? stack[stack.length - 1].backdrop : null);
    if (!backdrop) return;

    var index = -1;
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].backdrop === backdrop) { index = i; break; }
    }
    if (index === -1) {
      backdrop.hidden = true;
      return;
    }

    var entry = stack.splice(index, 1)[0];
    backdrop.hidden = true;

    if (stack.length) {
      // Reveal the dialog underneath.
      var below = stack[stack.length - 1];
      below.backdrop.hidden = false;
      setInitialFocus(below.backdrop, null);
    } else {
      unlockScroll();
      showBackground();
      if (opts.restoreFocus !== false && entry.returnFocus && document.contains(entry.returnFocus)) {
        try { entry.returnFocus.focus({ preventScroll: true }); } catch (err) { entry.returnFocus.focus(); }
      }
    }

    if (entry.onClose) entry.onClose();
  }

  /**
   * Swap the current dialog for another one, keeping the original trigger as
   * the focus-return target. Used by the multi-step cancellation flow.
   */
  function replace(target, options) {
    var opts = options || {};
    var current = stack.length ? stack[stack.length - 1] : null;
    var returnFocus = opts.returnFocus || (current ? current.returnFocus : null);
    if (current) {
      // Close silently: focus goes to the incoming dialog, not the trigger.
      close(current.backdrop, { restoreFocus: false });
    }
    return open(target, {
      returnFocus: returnFocus,
      initialFocus: opts.initialFocus,
      dismissible: opts.dismissible,
      onClose: opts.onClose
    });
  }

  function closeAll() {
    while (stack.length) close(stack[stack.length - 1].backdrop);
  }

  function isOpen(target) {
    var backdrop = resolve(target);
    return stack.some(function (entry) { return entry.backdrop === backdrop; });
  }

  /* --- wiring ------------------------------------------------------------- */

  document.addEventListener('keydown', onKeydown, true);

  document.addEventListener('click', function (event) {
    // data-dialog-open="#id" opens; data-dialog-close closes the nearest dialog.
    var opener = event.target.closest ? event.target.closest('[data-dialog-open]') : null;
    if (opener) {
      event.preventDefault();
      open(opener.getAttribute('data-dialog-open'), { returnFocus: opener });
      return;
    }

    var closer = event.target.closest ? event.target.closest('[data-dialog-close]') : null;
    if (closer) {
      event.preventDefault();
      var backdrop = closer.closest('.dialog-backdrop');
      close(backdrop || undefined);
      return;
    }

    // Click on the backdrop itself (not the panel) dismisses.
    if (event.target.classList && event.target.classList.contains('dialog-backdrop')) {
      var top = stack.length ? stack[stack.length - 1] : null;
      if (top && top.backdrop === event.target && top.dismissible) close(event.target);
    }
  });

  ZO.Dialog = {
    open: open,
    close: close,
    replace: replace,
    closeAll: closeAll,
    isOpen: isOpen,
    focusable: focusable,
    get depth() { return stack.length; }
  };
})(window, document);
