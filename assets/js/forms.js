/* =============================================================================
   ZO Hotel — forms.js
   Form plumbing shared by the booking form, the lookup form and the dialogs:
   value collection, inline error rendering, an error summary that links to the
   offending field, and re-validation once a field has been corrected.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var ZO = window.ZO || {};
  window.ZO = ZO;

  var icon = ZO.icon;
  var $ = ZO.$;
  var $$ = ZO.$$;

  /**
   * Read every named control in a form (or any container).
   * Checkboxes with a shared name collect into an object of booleans.
   */
  function values(scope) {
    var out = {};
    var controls = $$('input[name], select[name], textarea[name]', scope);
    controls.forEach(function (control) {
      var name = control.name;
      if (control.type === 'radio') {
        if (control.checked) out[name] = control.value;
        else if (!(name in out)) out[name] = '';
        return;
      }
      if (control.type === 'checkbox') {
        var group = $$('input[type="checkbox"][name="' + name + '"]', scope);
        if (group.length > 1 || control.dataset.group === 'true') {
          if (!out[name] || typeof out[name] !== 'object') out[name] = {};
          out[name][control.value] = control.checked;
        } else {
          out[name] = control.checked;
        }
        return;
      }
      out[name] = control.value;
    });
    return out;
  }

  function controlFor(scope, name) {
    return $('[name="' + name + '"]', scope) ||
      $('#' + name, scope) ||
      $('[data-field="' + name + '"]', scope);
  }

  function labelTextFor(scope, name) {
    var control = controlFor(scope, name);
    if (control) {
      if (control.id) {
        var label = $('label[for="' + control.id + '"]', scope);
        if (label) return label.textContent.replace(/\s*\(required\)\s*/i, '').replace(/\*/g, '').trim();
      }
      var fieldset = control.closest ? control.closest('fieldset') : null;
      if (fieldset) {
        var legend = $('legend', fieldset);
        if (legend) return legend.textContent.trim();
      }
    }
    return name;
  }

  /** Show one inline error and mark the control invalid. */
  function setError(scope, name, message) {
    var slot = $('[data-error-for="' + name + '"]', scope);
    if (slot) {
      slot.innerHTML = icon('warning', 14) + '<span>' + ZO.esc(message) + '</span>';
      slot.hidden = false;
    }
    var control = controlFor(scope, name);
    if (control) {
      if (control.type === 'radio' || control.type === 'checkbox') {
        var fieldset = control.closest('fieldset');
        if (fieldset) fieldset.setAttribute('data-invalid', 'true');
        $$('[name="' + name + '"]', scope).forEach(function (input) {
          input.setAttribute('aria-invalid', 'true');
        });
      } else {
        control.setAttribute('aria-invalid', 'true');
      }
      if (slot && slot.id) {
        var described = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (described.indexOf(slot.id) === -1) {
          described.push(slot.id);
          control.setAttribute('aria-describedby', described.join(' '));
        }
      }
    }
  }

  function clearError(scope, name) {
    var slot = $('[data-error-for="' + name + '"]', scope);
    if (slot) {
      slot.hidden = true;
      slot.innerHTML = '';
    }
    var control = controlFor(scope, name);
    if (control) {
      if (control.type === 'radio' || control.type === 'checkbox') {
        var fieldset = control.closest('fieldset');
        if (fieldset) fieldset.removeAttribute('data-invalid');
        $$('[name="' + name + '"]', scope).forEach(function (input) {
          input.removeAttribute('aria-invalid');
        });
      } else {
        control.removeAttribute('aria-invalid');
      }
    }
  }

  function clearAll(scope) {
    $$('[data-error-for]', scope).forEach(function (slot) {
      slot.hidden = true;
      slot.innerHTML = '';
    });
    $$('[aria-invalid="true"]', scope).forEach(function (control) {
      control.removeAttribute('aria-invalid');
    });
    $$('fieldset[data-invalid]', scope).forEach(function (fs) {
      fs.removeAttribute('data-invalid');
    });
    var summary = $('[data-error-summary]', scope);
    if (summary) {
      summary.hidden = true;
      summary.innerHTML = '';
    }
  }

  /**
   * Render the summary block at the top of the form. Each entry links to its
   * field so keyboard and screen-reader users can jump straight to it.
   */
  function renderSummary(scope, errors, options) {
    var summary = $('[data-error-summary]', scope);
    var names = Object.keys(errors);
    if (!summary) return;
    if (!names.length) {
      summary.hidden = true;
      summary.innerHTML = '';
      return;
    }

    var opts = options || {};
    var heading = opts.heading ||
      (names.length === 1
        ? 'One detail needs a change before we can continue'
        : names.length + ' details need a change before we can continue');

    var list = names.map(function (name) {
      var control = controlFor(scope, name);
      var id = control && control.id ? control.id : null;
      var text = ZO.esc(errors[name]);
      return id
        ? '<li><a href="#' + id + '" data-error-link="' + ZO.esc(name) + '">' + text + '</a></li>'
        : '<li>' + text + '</li>';
    }).join('');

    summary.innerHTML = '<h3>' + ZO.esc(heading) + '</h3><ul>' + list + '</ul>';
    summary.hidden = false;

    $$('[data-error-link]', summary).forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        var control = controlFor(scope, link.getAttribute('data-error-link'));
        if (control) {
          control.focus();
          if (control.scrollIntoView) {
            control.scrollIntoView({ block: 'center', behavior: ZO.prefersReducedMotion() ? 'auto' : 'smooth' });
          }
        }
      });
    });

    if (opts.focus !== false) {
      summary.setAttribute('tabindex', '-1');
      summary.focus();
    }
  }

  /**
   * Bind a form to a validator.
   * @param {HTMLFormElement} form
   * @param {{validate:Function, onValid:Function, summaryHeading?:string}} config
   */
  function bind(form, config) {
    if (!form) return null;
    var touched = {};

    function run(options) {
      var opts = options || {};
      var data = values(form);
      var result = config.validate(data) || { valid: true, errors: {} };
      var errors = result.errors || {};

      Object.keys(errors).forEach(function (name) {
        if (opts.only && opts.only !== name) return;
        setError(form, name, errors[name]);
      });

      // Clear anything that has been fixed.
      $$('[data-error-for]', form).forEach(function (slot) {
        var name = slot.getAttribute('data-error-for');
        if (!errors[name] && (!opts.only || opts.only === name)) clearError(form, name);
      });

      if (!opts.only) {
        renderSummary(form, errors, {
          heading: config.summaryHeading,
          focus: opts.focusSummary !== false
        });
      }
      return { data: data, errors: errors, valid: !Object.keys(errors).length };
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var result = run({ focusSummary: false });
      if (!result.valid) {
        var firstName = Object.keys(result.errors)[0];
        var control = controlFor(form, firstName);
        // Focus the field itself: faster than making the user read the summary.
        if (control) {
          control.focus();
          if (control.scrollIntoView) {
            control.scrollIntoView({ block: 'center', behavior: ZO.prefersReducedMotion() ? 'auto' : 'smooth' });
          }
        }
        return;
      }
      clearAll(form);
      config.onValid(result.data, form);
    });

    // Re-check a field once the guest has interacted with it, so errors clear
    // as soon as they are fixed rather than only on the next submit.
    form.addEventListener('blur', function (event) {
      var control = event.target;
      if (!control.name) return;
      touched[control.name] = true;
      run({ only: control.name });
    }, true);

    form.addEventListener('input', function (event) {
      var control = event.target;
      if (!control.name || !touched[control.name]) return;
      run({ only: control.name });
    });

    form.addEventListener('change', function (event) {
      var control = event.target;
      if (!control.name) return;
      touched[control.name] = true;
      run({ only: control.name });
    });

    return { run: run, values: function () { return values(form); } };
  }

  ZO.Form = {
    values: values,
    setError: setError,
    clearError: clearError,
    clearAll: clearAll,
    renderSummary: renderSummary,
    bind: bind,
    controlFor: controlFor,
    labelTextFor: labelTextFor
  };
})(window, document);
