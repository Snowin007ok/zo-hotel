/* =============================================================================
   ZO Hotel — core.js
   Shared browser runtime: DOM helpers, icons, storage, navigation, accordion,
   tooltips, toasts and banners. Classic script (no modules) so every page works
   when opened directly from the file system.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var ZO = window.ZO || {};
  window.ZO = ZO;

  /* --- DOM helpers -------------------------------------------------------- */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function on(el, type, handler, options) {
    if (el) el.addEventListener(type, handler, options);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === false || typeof value === 'undefined') return;
        if (key === 'class') node.className = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'dataset') {
          Object.keys(value).forEach(function (d) { node.dataset[d] = value[d]; });
        } else node.setAttribute(key, value === true ? '' : value);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || typeof child === 'undefined') return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  /** Escape text before it goes anywhere near innerHTML. */
  function esc(value) {
    return String(value === null || typeof value === 'undefined' ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* --- icons (inline SVG, currentColor) ---------------------------------- */

  var ICON_PATHS = {
    check: '<path d="M20 6L9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
    calendarSwap: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18M8.5 16h7M13 13.5l2.5 2.5-2.5 2.5"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z"/><path d="M9 12.5l2 2 4-4.5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16.5 14.5h.01"/>',
    tag: '<path d="M20.5 13.5l-7 7a2 2 0 01-2.8 0l-7.2-7.2V4h9.3l7.7 7.7a1.3 1.3 0 010 1.8z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 5.3a3.2 3.2 0 010 5.4M18 20a6.4 6.4 0 00-2-4.6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
    warning: '<path d="M12 4l8.5 15H3.5L12 4z"/><path d="M12 10v4M12 17h.01"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
    leaf: '<path d="M20 4C10 4 4 9 4 17v3M20 4c0 8-5 12-11 13"/>',
    headset: '<path d="M4 14v-2a8 8 0 1116 0v2"/><rect x="2.5" y="13.5" width="4" height="6.5" rx="1.6"/><rect x="17.5" y="13.5" width="4" height="6.5" rx="1.6"/><path d="M12 22h3.5a2 2 0 002-2"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    phone: '<path d="M6 3.5h3l1.6 4-2 1.4a10.5 10.5 0 006.5 6.5l1.4-2 4 1.6v3A2 2 0 0118.4 20C10.4 19.4 4.6 13.6 4 5.6A2 2 0 016 3.5z"/>',
    pin: '<path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    inbox: '<path d="M3 13l2.5-8h13L21 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z"/><path d="M3 13h5l1 2.5h6L16 13h5"/>',
    star: '<path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 4z"/>',
    sparkle: '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"/>'
  };

  /**
   * Inline SVG icon markup.
   * @param {string} name key in ICON_PATHS
   * @param {number} [size=20]
   */
  function icon(name, size) {
    var s = size || 20;
    var path = ICON_PATHS[name] || ICON_PATHS.info;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + path + '</svg>';
  }

  /* --- storage (safe under file:// and private browsing) ----------------- */

  var memoryStore = {};

  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        if (raw === null) {
          return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
        }
        return JSON.parse(raw);
      } catch (err) {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
      }
    },
    set: function (key, value) {
      memoryStore[key] = value;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        return false;
      }
    },
    remove: function (key) {
      delete memoryStore[key];
      try {
        window.localStorage.removeItem(key);
      } catch (err) { /* ignore */ }
    }
  };

  /* --- motion preference ------------------------------------------------- */

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* --- toasts (temporary, non-modal success alerts) --------------------- */

  function toastRegion() {
    var region = $('#toast-region');
    if (!region) {
      region = el('div', {
        id: 'toast-region',
        class: 'toast-region',
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'false'
      });
      document.body.appendChild(region);
    }
    return region;
  }

  /**
   * Short success alert: "{Thing} {actionDone}". At most one action, per the
   * UI Best Practices guidance on success alerts.
   * @param {string} message
   * @param {{actionLabel?:string, onAction?:Function, duration?:number}} [options]
   */
  function toast(message, options) {
    var opts = options || {};
    var region = toastRegion();
    var node = el('div', { class: 'toast' });
    node.appendChild(el('span', { html: icon('checkCircle', 18) }));
    node.appendChild(el('span', { text: message }));

    var timer = null;
    function dismiss() {
      if (timer) window.clearTimeout(timer);
      if (node.parentNode) node.parentNode.removeChild(node);
    }

    if (opts.actionLabel && typeof opts.onAction === 'function') {
      var action = el('button', { type: 'button', class: 'toast__action', text: opts.actionLabel });
      on(action, 'click', function () {
        dismiss();
        opts.onAction();
      });
      node.appendChild(action);
    }

    region.appendChild(node);
    var duration = opts.duration || (opts.actionLabel ? 9000 : 5000);
    timer = window.setTimeout(dismiss, duration);
    return dismiss;
  }

  /**
   * Persistent, non-modal banner. Used for anything the guest must not miss —
   * cancellations, refunds, failures — because temporary alerts must never
   * carry critical information.
   * @param {HTMLElement} mount
   * @param {{tone?:string, title:string, body?:string, dismissible?:boolean, actions?:Array}} config
   */
  function banner(mount, config) {
    if (!mount) return null;
    var tone = config.tone || 'info';
    var iconName = tone === 'success' ? 'checkCircle' : tone === 'error' ? 'warning' : tone === 'warn' ? 'warning' : 'info';
    var node = el('div', {
      class: 'banner banner--' + tone,
      role: tone === 'error' ? 'alert' : 'status'
    });
    node.appendChild(el('span', { class: 'banner__icon', html: icon(iconName, 22) }));

    var body = el('div', { class: 'banner__body' });
    body.appendChild(el('p', { class: 'banner__title', text: config.title }));
    if (config.body) body.appendChild(el('p', { html: config.body }));
    if (config.actions && config.actions.length) {
      var row = el('div', { class: 'btn-row', style: 'margin-top:.6rem' });
      config.actions.forEach(function (a) {
        var btn = el('button', { type: 'button', class: 'btn btn--sm ' + (a.variant || 'btn--outline'), text: a.label });
        on(btn, 'click', a.onClick);
        row.appendChild(btn);
      });
      body.appendChild(row);
    }
    node.appendChild(body);

    if (config.dismissible) {
      var close = el('button', {
        type: 'button',
        class: 'banner__close',
        'aria-label': 'Dismiss this message',
        html: icon('close', 18)
      });
      on(close, 'click', function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      node.appendChild(close);
    }

    mount.innerHTML = '';
    mount.appendChild(node);
    return node;
  }

  /* --- navigation -------------------------------------------------------- */

  function initNav() {
    var toggle = $('[data-nav-toggle]');
    var nav = $('[data-nav]');
    var header = $('[data-header]');
    if (!toggle || !nav) return;

    // Matches the drawer breakpoint in main.css.
    /* Must match the drawer breakpoint in main.css. The CSS turns the nav into
       a drawer at 1140px because the horizontal list wraps below that, and if
       this number disagrees the drawer renders open and unmanaged. */
    var mq = window.matchMedia('(max-width: 1140px)');

    function setOpenState(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.hidden = !open;
      // A transparent header over the hero needs a solid backing while open.
      if (header) header.classList.toggle('is-open', open);
    }

    function setMobile(isMobile) {
      if (isMobile) {
        setOpenState(false);
      } else {
        nav.hidden = false;
        toggle.setAttribute('aria-expanded', 'false');
        if (header) header.classList.remove('is-open');
      }
    }

    setMobile(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', function (e) { setMobile(e.matches); });
    } else if (mq.addListener) {
      mq.addListener(function (e) { setMobile(e.matches); });
    }

    on(toggle, 'click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      setOpenState(!open);
      if (!open) {
        var first = $('.nav__link', nav);
        if (first) first.focus();
      }
    });

    // Escape closes the drawer and returns focus to the toggle.
    on(nav, 'keydown', function (event) {
      if (event.key === 'Escape' && mq.matches) {
        setOpenState(false);
        toggle.focus();
      }
    });

    // Tapping a link closes the drawer.
    $$('.nav__link, .nav__cta .btn', nav).forEach(function (link) {
      on(link, 'click', function () {
        if (mq.matches) setOpenState(false);
      });
    });
  }

  /* --- header: transparent over the hero, solid once scrolled ----------- */

  function initHeaderScroll() {
    var header = $('[data-header]');
    if (!header) return;

    // Pages without a photographic hero are solid from the start.
    if (document.body.classList.contains('page--solid')) {
      header.classList.add('is-solid');
      return;
    }

    var threshold = 80;
    var ticking = false;

    function update() {
      var scrolled = (window.pageYOffset || document.documentElement.scrollTop) > threshold;
      header.classList.toggle('is-solid', scrolled);
      ticking = false;
    }

    update();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
  }

  /* --- hero search bar --------------------------------------------------- */

  /* Hands the chosen dates to booking.html. Done in script because a GET form
     submission does not carry a query string over the file:// protocol. */
  function initSearchForm() {
    var form = $('[data-search-form]');
    if (!form) return;

    var today = new Date();
    var iso = function (d) {
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    };
    var checkIn = $('#s-checkin');
    var checkOut = $('#s-checkout');
    if (checkIn) checkIn.min = iso(today);
    if (checkOut) checkOut.min = iso(new Date(today.getTime() + 86400000));

    on(checkIn, 'change', function () {
      if (!checkIn.value || !checkOut) return;
      var next = new Date(checkIn.value);
      next.setDate(next.getDate() + 1);
      checkOut.min = iso(next);
      if (!checkOut.value || checkOut.value <= checkIn.value) checkOut.value = iso(next);
    });

    on(form, 'submit', function (event) {
      event.preventDefault();
      var params = [];
      $$('select, input', form).forEach(function (control) {
        if (control.name && control.value) {
          params.push(encodeURIComponent(control.name) + '=' + encodeURIComponent(control.value));
        }
      });
      window.location.href = 'booking.html' + (params.length ? '?' + params.join('&') : '');
    });
  }

  /* --- accordion --------------------------------------------------------- */

  function initAccordions() {
    $$('[data-accordion]').forEach(function (root) {
      $$('.accordion__btn', root).forEach(function (btn) {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (!panel) return;
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        panel.hidden = !expanded;

        on(btn, 'click', function () {
          var isOpen = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
          panel.hidden = isOpen;
        });
      });
    });
  }

  /* --- tooltips ---------------------------------------------------------- */

  /* Triggered by a real button so mouse, keyboard and touch all work. Shows on
     hover, focus, and click; hides on Escape, blur and outside click. */
  function initTooltips() {
    $$('[data-tip]').forEach(function (wrap) {
      var btn = $('.tip__btn', wrap);
      var bubble = $('.tip__bubble', wrap);
      if (!btn || !bubble) return;

      function show() { bubble.hidden = false; }
      function hide() { bubble.hidden = true; }

      on(btn, 'mouseenter', show);
      on(btn, 'focus', show);
      on(btn, 'mouseleave', hide);
      on(btn, 'blur', hide);
      on(btn, 'click', function (event) {
        event.preventDefault();
        bubble.hidden = !bubble.hidden;
      });
      on(btn, 'keydown', function (event) {
        if (event.key === 'Escape') hide();
      });
    });

    on(document, 'click', function (event) {
      $$('.tip__bubble').forEach(function (bubble) {
        var wrap = bubble.closest('[data-tip]');
        if (wrap && !wrap.contains(event.target)) bubble.hidden = true;
      });
    });
  }

  /* --- reveal on scroll -------------------------------------------------- */

  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-in'); });
      return;
    }
    var io = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (item) { io.observe(item); });
  }

  /* --- misc -------------------------------------------------------------- */

  function initYear() {
    $$('[data-year]').forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });
  }

  /** Mark stacked-on-mobile tables and stamp cells with their column label. */
  function initStackedTables() {
    $$('table.data[data-stacked]').forEach(function (table) {
      table.classList.add('is-stacked');
      var heads = $$('thead th', table).map(function (th) { return th.textContent.trim(); });
      $$('tbody tr', table).forEach(function (row) {
        $$('td', row).forEach(function (cell, index) {
          var offset = $('th[scope="row"]', row) ? index + 1 : index;
          if (heads[offset]) cell.setAttribute('data-label', heads[offset]);
        });
      });
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /* --- exports ----------------------------------------------------------- */

  ZO.$ = $;
  ZO.$$ = $$;
  ZO.on = on;
  ZO.el = el;
  ZO.esc = esc;
  ZO.icon = icon;
  ZO.store = store;
  ZO.toast = toast;
  ZO.banner = banner;
  ZO.ready = ready;
  ZO.prefersReducedMotion = prefersReducedMotion;

  ready(function () {
    initNav();
    initHeaderScroll();
    initSearchForm();
    initAccordions();
    initTooltips();
    initReveal();
    initYear();
    initStackedTables();
  });
})(window, document);
