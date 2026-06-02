(function () {
  'use strict';

  const {
    courtSlabs, advocateSlabs,
    escapeHtml, hl, formatINR, formatINRDecimal, describeSlab,
    calculateCourtFee, calculateAdvocateFee,
    attachExpressionFormatter, attachDecimalConstraint, evaluateExpression, bindCopy
  } = window.lib;

  function formatDateDisplay(iso) {
    const [y, m, d] = iso.split('-');
    return d + '/' + m + '/' + y;
  }

  // Auto-insert "/" as the user types. Slash is appended the moment the 2nd
  // (and 4th) digit lands, but only when the value is growing — so backspacing
  // through a slash actually removes it instead of re-adding.
  function attachDateInput(el, onInput) {
    let prev = el.value;
    el.addEventListener('input', function () {
      const growing = el.value.length > prev.length;
      const digits = el.value.replace(/\D/g, '').slice(0, 8);
      let out;
      if (digits.length >= 5) {
        out = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
      } else if (digits.length === 4 && growing) {
        out = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/';
      } else if (digits.length >= 3) {
        out = digits.slice(0, 2) + '/' + digits.slice(2);
      } else if (digits.length === 2 && growing) {
        out = digits + '/';
      } else {
        out = digits;
      }
      if (el.value !== out) el.value = out;
      prev = el.value;
      if (onInput) onInput();
    });
  }

  // Parse "dd/mm/yyyy" or "dd/mm/yy" (yy → 20yy). Returns a status object so
  // the caller can distinguish empty / malformed / impossible-calendar-date.
  function parseDateInput(str) {
    if (!str || !str.trim()) return { status: 'empty' };
    const parts = str.trim().split('/');
    if (parts.length !== 3) return { status: 'format' };
    let [dd, mm, yy] = parts;
    if (!/^\d{1,2}$/.test(dd) || !/^\d{1,2}$/.test(mm) || !/^\d+$/.test(yy)) return { status: 'format' };
    if (yy.length === 2) yy = '20' + yy;
    if (yy.length !== 4) return { status: 'format' };
    const d = +dd, m = +mm, y = +yy;
    if (m < 1 || m > 12 || d < 1 || d > 31) return { status: 'calendar' };
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return { status: 'calendar' };
    const pad = n => String(n).padStart(2, '0');
    return { status: 'ok', iso: y + '-' + pad(m) + '-' + pad(d) };
  }

  // Whole days between two yyyy-mm-dd strings, treating dates as UTC midnight
  // to avoid DST artifacts. Per spec: include initial date, exclude filing date,
  // which is exactly (filing - initial) in days.
  function daysBetween(startStr, endStr) {
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const start = Date.UTC(sy, sm - 1, sd);
    const end = Date.UTC(ey, em - 1, ed);
    return Math.round((end - start) / 86400000);
  }

  const clientNameInput = document.getElementById('clientName');
  const bankNameInput = document.getElementById('bankName');
  const accountsContainer = document.getElementById('accountsContainer');
  const addAccountBtn = document.getElementById('addAccountBtn');
  const advocateMiscInput = document.getElementById('advocateMisc');
  const calcBtn = document.getElementById('calcBtn');
  const clearBtn = document.getElementById('clearBtn');
  const errorMsg = document.getElementById('errorMsg');
  const results = document.getElementById('results');
  const accountResults = document.getElementById('accountResults');
  const totalNetValue = document.getElementById('totalNetValue');
  const courtFeeValue = document.getElementById('courtFeeValue');
  const courtFeeSlab = document.getElementById('courtFeeSlab');
  const advocateFeeValue = document.getElementById('advocateFeeValue');
  const advocateFeeSlab = document.getElementById('advocateFeeSlab');
  const copyCourt = document.getElementById('copyCourt');
  const copyAdvocate = document.getElementById('copyAdvocate');
  const copyCourtFeedback = document.getElementById('copyCourtFeedback');
  const copyAdvocateFeedback = document.getElementById('copyAdvocateFeedback');
  const printBtn = document.getElementById('printBtn');
  const pName = document.getElementById('pName');
  const pBank = document.getElementById('pBank');
  const pAccountsContainer = document.getElementById('pAccountsContainer');
  const pTotal = document.getElementById('pTotal');
  const pCourtSlab = document.getElementById('pCourtSlab');
  const pAdvSlab = document.getElementById('pAdvSlab');
  const pAdvHalf = document.getElementById('pAdvHalf');
  const pAdvMisc = document.getElementById('pAdvMisc');
  const pCourtFee = document.getElementById('pCourtFee');
  const pAdvFee = document.getElementById('pAdvFee');

  attachExpressionFormatter(advocateMiscInput, clearErrorState);

  let courtFeeRaw = 0;
  let advocateFinalRaw = 0;
  let accountCounter = 0;

  function renumberAccountCards() {
    const cards = accountsContainer.querySelectorAll('.account-card');
    cards.forEach((card, idx) => {
      const title = card.querySelector('.account-card-title');
      if (title) title.textContent = 'Account #' + (idx + 1);
      const removeBtn = card.querySelector('.account-remove');
      if (removeBtn) removeBtn.disabled = (cards.length <= 1);
    });
  }

  function addAccountCard(focusFirst) {
    accountCounter++;
    const card = document.createElement('div');
    card.className = 'account-card';
    card.innerHTML =
      '<div class="account-card-header">' +
        '<span class="account-card-title">Account</span>' +
        '<button type="button" class="account-remove" aria-label="Remove account">&times;</button>' +
      '</div>' +
      '<div class="input-row">' +
        '<label>A/c No.</label>' +
        '<input type="text" class="acc-number" autocomplete="off" spellcheck="false" placeholder="Account number">' +
      '</div>' +
      '<div class="input-row">' +
        '<label>Principal Amount (₹)</label>' +
        '<input type="text" class="acc-principal" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="e.g. 5,00,000 or 1800+200+800">' +
      '</div>' +
      '<div class="input-row">' +
        '<label>Interest Rate (% p.a.)</label>' +
        '<input type="text" class="acc-rate" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="e.g. 8.5">' +
      '</div>' +
      '<div class="input-grid">' +
        '<div>' +
          '<label>Initial Date</label>' +
          '<input type="text" class="acc-init" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="dd/mm/yyyy" maxlength="10">' +
        '</div>' +
        '<div>' +
          '<label>Filing Date</label>' +
          '<input type="text" class="acc-filing" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="dd/mm/yyyy" maxlength="10">' +
        '</div>' +
      '</div>' +
      '<div class="input-row">' +
        '<label>Misc Fees (₹) <span style="font-weight:400;color:#7d8694">— notice fees etc., added to this account\'s net</span></label>' +
        '<input type="text" class="acc-misc" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="e.g. 1,000 or 500+500">' +
      '</div>';
    accountsContainer.appendChild(card);

    const principalEl = card.querySelector('.acc-principal');
    const rateEl = card.querySelector('.acc-rate');
    const initEl = card.querySelector('.acc-init');
    const filEl = card.querySelector('.acc-filing');
    const numEl = card.querySelector('.acc-number');
    const miscEl = card.querySelector('.acc-misc');
    attachExpressionFormatter(principalEl, clearErrorState);
    attachDecimalConstraint(rateEl, clearErrorState);
    attachExpressionFormatter(miscEl, clearErrorState);
    attachDateInput(initEl, clearErrorState);
    attachDateInput(filEl, clearErrorState);
    numEl.addEventListener('input', clearErrorState);

    card.querySelector('.account-remove').addEventListener('click', function () {
      const cards = accountsContainer.querySelectorAll('.account-card');
      if (cards.length <= 1) return;
      card.remove();
      renumberAccountCards();
      clearErrorState();
    });

    renumberAccountCards();
    if (focusFirst) {
      setTimeout(function () { numEl.focus(); }, 30);
    }
    return card;
  }

  addAccountBtn.addEventListener('click', function () { addAccountCard(true); });

  function clearErrorState() {
    if (errorMsg.textContent) {
      errorMsg.textContent = '';
      document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
    }
  }

  function showError(msg, fields) {
    errorMsg.textContent = msg;
    document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
    (fields || []).forEach(el => el.classList.add('error'));
    results.classList.remove('visible');
  }

  function clearAll() {
    clientNameInput.value = '';
    bankNameInput.value = '';
    advocateMiscInput.value = '';
    accountsContainer.innerHTML = '';
    accountCounter = 0;
    addAccountCard(false);
    errorMsg.textContent = '';
    document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
    results.classList.remove('visible');
    clearBtn.classList.remove('visible');
    clientNameInput.focus();
  }

  function readAccount(card, idx) {
    const numEl = card.querySelector('.acc-number');
    const principalEl = card.querySelector('.acc-principal');
    const rateEl = card.querySelector('.acc-rate');
    const initEl = card.querySelector('.acc-init');
    const filEl = card.querySelector('.acc-filing');
    const miscEl = card.querySelector('.acc-misc');

    const label = 'Account #' + (idx + 1);
    const accNo = numEl.value.trim();
    const rRaw = rateEl.value.trim();
    const sParsed = parseDateInput(initEl.value);
    const fParsed = parseDateInput(filEl.value);
    const sIso = sParsed.iso;
    const fIso = fParsed.iso;

    const principalVal = evaluateExpression(principalEl.value);
    if (principalVal === null) return { error: label + ': enter principal amount.', field: principalEl };
    if (isNaN(principalVal) || !isFinite(principalVal) || principalVal <= 0)
      return { error: label + ': principal must be positive.', field: principalEl };
    const principal = Math.round(principalVal);

    if (rRaw === '') return { error: label + ': enter interest rate.', field: rateEl };
    const ratePct = Number(rRaw);
    if (!isFinite(ratePct) || isNaN(ratePct) || ratePct < 0)
      return { error: label + ': rate must be zero or positive.', field: rateEl };

    if (sParsed.status === 'empty') return { error: label + ': enter initial date.', field: initEl };
    if (sParsed.status === 'format') return { error: label + ': initial date must be dd/mm/yyyy.', field: initEl };
    if (sParsed.status === 'calendar') return { error: label + ': initial date is not a valid calendar date.', field: initEl };
    if (fParsed.status === 'empty') return { error: label + ': enter filing date.', field: filEl };
    if (fParsed.status === 'format') return { error: label + ': filing date must be dd/mm/yyyy.', field: filEl };
    if (fParsed.status === 'calendar') return { error: label + ': filing date is not a valid calendar date.', field: filEl };

    const days = daysBetween(sIso, fIso);
    if (days <= 0) return { error: label + ': filing date must be after initial date.', field: filEl };

    let misc = 0;
    const miscVal = evaluateExpression(miscEl.value);
    if (miscVal !== null) {
      if (isNaN(miscVal) || !isFinite(miscVal) || miscVal < 0)
        return { error: label + ': misc fees must be zero or positive.', field: miscEl };
      misc = Math.round(miscVal);
    }

    const rateDec = ratePct / 100;
    const dailyInterest = (principal * rateDec) / 365;
    const totalInterest = dailyInterest * days;
    const netAmount = principal + totalInterest + misc;

    return {
      label, accNo, principal, ratePct, sIso, fIso, misc,
      days, dailyInterest, totalInterest, netAmount
    };
  }

  function renderAccountResult(a) {
    const accInfo = a.accNo
      ? '<span style="color:#8a93a1;font-weight:400;margin-left:8px">A/c ' + escapeHtml(a.accNo) + '</span>'
      : '';
    const miscPart = a.misc > 0 ? ' + Misc ' + hl(a.misc) : '';
    return '' +
      '<div class="account-result">' +
        '<div class="account-result-title">' + escapeHtml(a.label) + accInfo + '</div>' +
        '<div class="result-slab">Daily SI = ' + hl(a.dailyInterest.toFixed(2)) + '<br>' +
          a.days.toLocaleString('en-IN') + ' days<br>' +
          'Interest = ' + hl(a.totalInterest.toFixed(2)) + '<br>' +
          'Net = Principal + Interest' + miscPart + ' = ' + hl(Math.round(a.netAmount)) + '</div>' +
        '<div class="breakdown-grid">' +
          '<div class="breakdown-item"><div class="k">Days</div><div class="v">' + a.days.toLocaleString('en-IN') + '</div></div>' +
          '<div class="breakdown-item"><div class="k">Daily Interest</div><div class="v">' + formatINRDecimal(a.dailyInterest) + '</div></div>' +
          '<div class="breakdown-item"><div class="k">Total Interest</div><div class="v">' + formatINRDecimal(a.totalInterest) + '</div></div>' +
          '<div class="breakdown-item"><div class="k">Misc Fees</div><div class="v">' + formatINR(a.misc) + '</div></div>' +
          '<div class="breakdown-item" style="grid-column:1/-1"><div class="k">Net Amount</div><div class="v">' + formatINR(Math.round(a.netAmount)) + '</div></div>' +
        '</div>' +
      '</div>';
  }

  function renderPrintAccount(a, idx) {
    const accLabel = escapeHtml(a.label) + (a.accNo ? ' — A/c No. ' + escapeHtml(a.accNo) : '');
    return '' +
      '<div class="sheet-account-block">' +
        '<div class="sheet-account-title">' + accLabel + '</div>' +
        '<div class="sheet-row sheet-two">' +
          '<div><span class="sl">Amount:</span> <span class="sv">' + formatINR(a.principal) + '</span></div>' +
          '<div><span class="sl">Interest Rate:</span> <span class="sv">' + escapeHtml(String(a.ratePct)) + '% p.a.</span></div>' +
        '</div>' +
        '<div class="sheet-row sheet-dates">' +
          '<span><span class="sl">Initial Date:</span> <span class="sv">' + formatDateDisplay(a.sIso) + '</span></span>' +
          '<span class="sl">to</span>' +
          '<span><span class="sl">Filing date:</span> <span class="sv">' + formatDateDisplay(a.fIso) + '</span></span>' +
          '<span style="white-space:nowrap"><span class="sl">= No. of days:</span> <span class="sv">' + a.days.toLocaleString('en-IN') + '</span></span>' +
        '</div>' +
        '<div class="sheet-formula-block">' +
          '<div class="sheet-formula-line">' +
            '<span class="sl">Daily interest:</span>' +
            '<span class="sfrac"><span class="snum">' + formatINR(a.principal) + ' × ' + escapeHtml(String(a.ratePct)) + '%</span><span class="sden">365</span></span>' +
            '<span>= <span class="sv">' + formatINRDecimal(a.dailyInterest) + '</span></span>' +
          '</div>' +
        '</div>' +
        '<div class="sheet-formula-block">' +
          '<div class="sheet-formula-line">' +
            '<span class="sl">Total interest:</span>' +
            '<span>' + formatINRDecimal(a.dailyInterest) + ' × ' + a.days.toLocaleString('en-IN') + ' days = <span class="sv">' + formatINRDecimal(a.totalInterest) + '</span></span>' +
          '</div>' +
        '</div>' +
        '<div class="sheet-row sheet-net-row">' +
          '<span class="sl">Net Amount:</span> ' +
          '<span>' + formatINR(a.principal) + ' + ' + formatINRDecimal(a.totalInterest) +
            (a.misc > 0 ? ' + ' + formatINR(a.misc) + ' (misc)' : '') +
            ' = <span class="sv sv-big">' + formatINR(Math.round(a.netAmount)) + '</span></span>' +
        '</div>' +
      '</div>';
  }

  function doCalculate() {
    const cards = accountsContainer.querySelectorAll('.account-card');
    if (cards.length === 0) return showError('Add at least one account.', []);

    const accounts = [];
    for (let i = 0; i < cards.length; i++) {
      const res = readAccount(cards[i], i);
      if (res.error) return showError(res.error, [res.field]);
      accounts.push(res);
    }

    let advMisc = 0;
    const advMiscVal = evaluateExpression(advocateMiscInput.value);
    if (advMiscVal !== null) {
      if (isNaN(advMiscVal) || !isFinite(advMiscVal) || advMiscVal < 0)
        return showError('Advocate misc fees must be zero or positive.', [advocateMiscInput]);
      advMisc = Math.round(advMiscVal);
    }

    clearErrorState();

    const totalNet = accounts.reduce((s, a) => s + a.netAmount, 0);
    const totalNetRounded = Math.round(totalNet);

    const court = calculateCourtFee(totalNetRounded);
    const advocate = calculateAdvocateFee(totalNetRounded);
    const advocateHalf = Math.round(advocate.fee / 2);
    const advocateFinal = advocateHalf + advMisc;

    courtFeeRaw = court.fee;
    advocateFinalRaw = advocateFinal;

    accountResults.innerHTML = accounts.map(renderAccountResult).join('');
    totalNetValue.textContent = formatINR(totalNetRounded);

    courtFeeValue.textContent = formatINR(court.fee);
    const courtSlabHtml = describeSlab(courtSlabs, totalNetRounded);
    courtFeeSlab.innerHTML = courtSlabHtml + '<br>Computed on Net Suit Value ' + hl(totalNetRounded);

    advocateFeeValue.textContent = formatINR(advocateFinal);
    let advText = describeSlab(advocateSlabs, totalNetRounded);
    if (advText) {
      advText += '<br>Full ' + hl(advocate.fee) + ', half = ' + hl(advocateHalf);
      if (advMisc > 0) advText += ' + Advocate Misc ' + hl(advMisc) + ' = ' + hl(advocateFinal);
    }
    if (advText && advocate.minimumApplied) {
      advText += '<br>Minimum ' + hl(500) + ' applied';
    }
    advocateFeeSlab.innerHTML = advText;

    // Print sheet
    pName.textContent = clientNameInput.value.trim() || '';
    pBank.textContent = bankNameInput.value.trim() || '';
    pAccountsContainer.innerHTML = accounts.map(renderPrintAccount).join('');
    pTotal.textContent = formatINR(totalNetRounded);
    pCourtSlab.innerHTML = courtSlabHtml;
    const pAdvSlabHtml = describeSlab(advocateSlabs, totalNetRounded);
    pAdvSlab.innerHTML = pAdvSlabHtml;
    pAdvHalf.innerHTML = 'Full = ' + hl(advocate.fee) + ' &nbsp;|&nbsp; Half = ' + hl(advocateHalf);
    if (advMisc > 0) {
      pAdvMisc.innerHTML = 'Advocate Misc Fee = ' + hl(advMisc);
      pAdvMisc.style.display = '';
    } else {
      pAdvMisc.innerHTML = '';
      pAdvMisc.style.display = 'none';
    }
    pCourtFee.textContent = formatINR(court.fee);
    pAdvFee.textContent = formatINR(advocateFinal);

    results.classList.add('visible');
    clearBtn.classList.add('visible');
  }

  calcBtn.addEventListener('click', doCalculate);
  clearBtn.addEventListener('click', clearAll);
  printBtn.addEventListener('click', function () { window.print(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      if (e.target === copyCourt || e.target === copyAdvocate || e.target === printBtn) return;
      if (e.target === addAccountBtn) return;
      if (e.target && e.target.classList && e.target.classList.contains('account-remove')) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'BODY' || e.target === calcBtn) {
        e.preventDefault();
        doCalculate();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearAll();
    }
  });

  bindCopy(copyCourt, () => courtFeeRaw, copyCourtFeedback);
  bindCopy(copyAdvocate, () => advocateFinalRaw, copyAdvocateFeedback);

  // Seed with first account card.
  addAccountCard(false);
  clientNameInput.focus();
})();
