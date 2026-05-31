// Shared fee math + formatters + input helpers used by all calculator pages.
// Slab tables are duplicated between the declarative arrays and the imperative
// calculator functions for clarity/performance — keep them in sync.

(function (global) {
  'use strict';

  const courtSlabs = [
    { n: '(i)',    floor: 0,       max: 15000,    base: 0,      rate: 0.025, range: 'Up to ₹15,000' },
    { n: '(ii)',   floor: 15000,   max: 75000,    base: 375,    rate: 0.075, range: '₹15,001 to ₹75,000' },
    { n: '(iii)',  floor: 75000,   max: 250000,   base: 4875,   rate: 0.070, range: '₹75,001 to ₹2,50,000' },
    { n: '(iv)',   floor: 250000,  max: 500000,   base: 17125,  rate: 0.065, range: '₹2,50,001 to ₹5,00,000' },
    { n: '(v)',    floor: 500000,  max: 750000,   base: 33375,  rate: 0.060, range: '₹5,00,001 to ₹7,50,000' },
    { n: '(vi)',   floor: 750000,  max: 1000000,  base: 48375,  rate: 0.055, range: '₹7,50,001 to ₹10,00,000' },
    { n: '(vii)',  floor: 1000000, max: 1500000,  base: 62125,  rate: 0.050, range: '₹10,00,001 to ₹15,00,000' },
    { n: '(viii)', floor: 1500000, max: 2000000,  base: 87125,  rate: 0.045, range: '₹15,00,001 to ₹20,00,000' },
    { n: '(ix)',   floor: 2000000, max: 2500000,  base: 109625, rate: 0.040, range: '₹20,00,001 to ₹25,00,000' },
    { n: '(x)',    floor: 2500000, max: 3000000,  base: 129625, rate: 0.035, range: '₹25,00,001 to ₹30,00,000' },
    { n: '(xi)',   floor: 3000000, max: 4000000,  base: 147125, rate: 0.030, range: '₹30,00,001 to ₹40,00,000' },
    { n: '(xii)',  floor: 4000000, max: 5000000,  base: 177125, rate: 0.025, range: '₹40,00,001 to ₹50,00,000' },
    { n: '(xiii)', floor: 5000000, max: 6000000,  base: 202125, rate: 0.020, range: '₹50,00,001 to ₹60,00,000' },
    { n: '(xiv)',  floor: 6000000, max: Infinity, base: 222125, rate: 0.015, range: 'Above ₹60,00,000' }
  ];

  const advocateSlabs = [
    { n: '(a)', floor: 0,      max: 5000,     base: 0,    rate: 0.100, range: 'Up to ₹5,000' },
    { n: '(b)', floor: 5000,   max: 10000,    base: 500,  rate: 0.075, range: '₹5,001 to ₹10,000' },
    { n: '(c)', floor: 10000,  max: 20000,    base: 875,  rate: 0.055, range: '₹10,001 to ₹20,000' },
    { n: '(d)', floor: 20000,  max: 50000,    base: 1425, rate: 0.040, range: '₹20,001 to ₹50,000' },
    { n: '(e)', floor: 50000,  max: 100000,   base: 2625, rate: 0.030, range: '₹50,001 to ₹1,00,000' },
    { n: '(f)', floor: 100000, max: Infinity, base: 4125, rate: 0.015, range: 'Above ₹1,00,000' }
  ];

  function formatPct(r) {
    return (r * 100).toFixed(1).replace(/\.0$/, '') + '%';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  function hl(amount) {
    return '<span class="hl">₹' + Number(amount).toLocaleString('en-IN') + '</span>';
  }

  function formatINR(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function formatINRDecimal(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function describeSlab(slabs, value) {
    const idx = slabs.findIndex(s => value <= s.max);
    if (idx < 0) return '';
    const s = slabs[idx];
    const excess = Math.max(0, value - s.floor);
    const incrementAmt = Math.round(excess * s.rate);
    let parts = escapeHtml(s.n + ' ' + s.range) + ' — ';
    if (s.floor === 0) {
      parts += formatPct(s.rate) + ' of ' + hl(value) + ' = ' + hl(incrementAmt);
    } else {
      parts += 'Base: ' + hl(s.base)
            + ' + ' + formatPct(s.rate)
            + ' on excess of ₹' + excess.toLocaleString('en-IN')
            + ' = ' + hl(incrementAmt);
    }
    return parts;
  }

  function calculateCourtFee(v) {
    if (v <= 0) return { fee: 0, slabIndex: -1 };
    let fee;
    if (v <= 15000)      fee = v * 0.025;
    else if (v <= 75000) fee = 375 + (v - 15000) * 0.075;
    else if (v <= 250000) fee = 4875 + (v - 75000) * 0.070;
    else if (v <= 500000) fee = 17125 + (v - 250000) * 0.065;
    else if (v <= 750000) fee = 33375 + (v - 500000) * 0.060;
    else if (v <= 1000000) fee = 48375 + (v - 750000) * 0.055;
    else if (v <= 1500000) fee = 62125 + (v - 1000000) * 0.050;
    else if (v <= 2000000) fee = 87125 + (v - 1500000) * 0.045;
    else if (v <= 2500000) fee = 109625 + (v - 2000000) * 0.040;
    else if (v <= 3000000) fee = 129625 + (v - 2500000) * 0.035;
    else if (v <= 4000000) fee = 147125 + (v - 3000000) * 0.030;
    else if (v <= 5000000) fee = 177125 + (v - 4000000) * 0.025;
    else if (v <= 6000000) fee = 202125 + (v - 5000000) * 0.020;
    else                   fee = 222125 + (v - 6000000) * 0.015;
    let slabIndex = courtSlabs.findIndex(s => v <= s.max);
    return { fee: Math.round(fee), slabIndex: slabIndex };
  }

  function calculateAdvocateFee(v) {
    if (v <= 0) return { fee: 0, slabIndex: -1, minimumApplied: false };
    let raw;
    if (v <= 5000)        raw = v * 0.10;
    else if (v <= 10000)  raw = 500 + (v - 5000) * 0.075;
    else if (v <= 20000)  raw = 875 + (v - 10000) * 0.055;
    else if (v <= 50000)  raw = 1425 + (v - 20000) * 0.040;
    else if (v <= 100000) raw = 2625 + (v - 50000) * 0.030;
    else                  raw = 4125 + (v - 100000) * 0.015;
    const fee = Math.max(raw, 500);
    const slabIndex = advocateSlabs.findIndex(s => v <= s.max);
    return { fee: Math.round(fee), slabIndex: slabIndex, minimumApplied: Math.round(raw) < 500 };
  }

  // Indian-numbering caret-preserving integer formatter.
  function countDigits(str, upto) {
    let n = 0;
    for (let i = 0; i < upto && i < str.length; i++) {
      if (str.charCodeAt(i) >= 48 && str.charCodeAt(i) <= 57) n++;
    }
    return n;
  }
  function caretAfterNthDigit(str, n) {
    if (n <= 0) return 0;
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) >= 48 && str.charCodeAt(i) <= 57) {
        count++;
        if (count === n) return i + 1;
      }
    }
    return str.length;
  }
  function attachIntFormatter(el, onInput) {
    el.addEventListener('keydown', function (e) {
      const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter','Escape'];
      if (allowed.indexOf(e.key) !== -1) return;
      if (e.ctrlKey || e.metaKey) return;
      if (!/^[0-9]$/.test(e.key)) e.preventDefault();
    });
    el.addEventListener('input', function () {
      const prev = el.value;
      const selStart = el.selectionStart || 0;
      const digitsBefore = countDigits(prev, selStart);
      const digitsOnly = prev.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
      const formatted = digitsOnly === '' ? '' : Number(digitsOnly).toLocaleString('en-IN');
      if (formatted !== prev) {
        el.value = formatted;
        const newPos = caretAfterNthDigit(formatted, digitsBefore);
        try { el.setSelectionRange(newPos, newPos); } catch (e) {}
      }
      if (onInput) onInput();
    });
  }
  // Tiny safe parser for + - * / and parens with numeric literals. No eval.
  // Returns null for empty input, NaN for invalid, otherwise the numeric result.
  function evaluateExpression(input) {
    if (input == null) return null;
    const s = String(input).replace(/[,\s]/g, '');
    if (s === '') return null;
    if (!/^[0-9+\-*/().]+$/.test(s)) return NaN;

    let pos = 0;
    function parseNumber() {
      const start = pos;
      while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
      if (start === pos) return NaN;
      const n = parseFloat(s.slice(start, pos));
      return isFinite(n) ? n : NaN;
    }
    function parseFactor() {
      if (s[pos] === '(') {
        pos++;
        const v = parseExpr();
        if (s[pos] !== ')') return NaN;
        pos++;
        return v;
      }
      if (s[pos] === '-') { pos++; return -parseFactor(); }
      if (s[pos] === '+') { pos++; return parseFactor(); }
      return parseNumber();
    }
    function parseTerm() {
      let v = parseFactor();
      while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
        const op = s[pos++];
        const r = parseFactor();
        v = op === '*' ? v * r : v / r;
      }
      return v;
    }
    function parseExpr() {
      let v = parseTerm();
      while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
        const op = s[pos++];
        const r = parseTerm();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }

    const result = parseExpr();
    if (pos !== s.length) return NaN;
    if (!isFinite(result)) return NaN;
    return result;
  }

  // Amount-field formatter that also allows inline math expressions.
  // While the user is typing pure digits/commas, applies Indian-numbering
  // formatting (caret-preserving) like attachIntFormatter. As soon as an
  // operator is typed, formatting steps aside so the expression isn't mangled.
  // On blur, the expression is evaluated and replaced with the formatted
  // integer result (decimal results are rounded — amounts are integer).
  function attachExpressionFormatter(el, onInput) {
    el.addEventListener('keydown', function (e) {
      const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter','Escape'];
      if (allowed.indexOf(e.key) !== -1) return;
      if (e.ctrlKey || e.metaKey) return;
      if (/^[0-9+\-*/(). ]$/.test(e.key)) return;
      e.preventDefault();
    });
    el.addEventListener('input', function () {
      const prev = el.value;
      if (/^[\d,\s]*$/.test(prev)) {
        const selStart = el.selectionStart || 0;
        const digitsBefore = countDigits(prev, selStart);
        const digitsOnly = prev.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
        const formatted = digitsOnly === '' ? '' : Number(digitsOnly).toLocaleString('en-IN');
        if (formatted !== prev) {
          el.value = formatted;
          const newPos = caretAfterNthDigit(formatted, digitsBefore);
          try { el.setSelectionRange(newPos, newPos); } catch (e) {}
        }
      }
      if (onInput) onInput();
    });
    el.addEventListener('blur', function () {
      const raw = el.value.trim();
      if (raw === '') return;
      const v = evaluateExpression(raw);
      if (v !== null && !isNaN(v) && isFinite(v)) {
        el.value = Math.round(v).toLocaleString('en-IN');
      }
    });
  }

  function attachDecimalConstraint(el, onInput) {
    el.addEventListener('keydown', function (e) {
      const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter','Escape'];
      if (allowed.indexOf(e.key) !== -1) return;
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === '.' && el.value.indexOf('.') === -1) return;
      if (!/^[0-9]$/.test(e.key)) e.preventDefault();
    });
    if (onInput) el.addEventListener('input', onInput);
  }

  // Standard copy-to-clipboard with feedback-pill animation.
  function copyAmount(amount, feedbackEl) {
    const text = String(amount);
    const showOk = () => {
      feedbackEl.classList.add('show');
      setTimeout(() => feedbackEl.classList.remove('show'), 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showOk, fallback);
    } else {
      fallback();
    }
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      showOk();
    }
  }

  function bindCopy(btn, getAmount, feedbackEl) {
    btn.addEventListener('click', function () { copyAmount(getAmount(), feedbackEl); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyAmount(getAmount(), feedbackEl);
      }
    });
  }

  global.lib = {
    courtSlabs, advocateSlabs,
    formatPct, escapeHtml, hl, formatINR, formatINRDecimal, describeSlab,
    calculateCourtFee, calculateAdvocateFee,
    attachIntFormatter, attachDecimalConstraint, attachExpressionFormatter,
    evaluateExpression,
    copyAmount, bindCopy
  };
})(window);
