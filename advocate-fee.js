(function () {
  'use strict';

  const {
    advocateSlabs, calculateAdvocateFee, describeSlab,
    formatINR, hl, attachExpressionFormatter, evaluateExpression, bindCopy
  } = window.lib;

  const amountInput = document.getElementById('amount');
  const advocateMiscInput = document.getElementById('advocateMisc');
  const calcBtn = document.getElementById('calcBtn');
  const clearBtn = document.getElementById('clearBtn');
  const errorMsg = document.getElementById('errorMsg');
  const results = document.getElementById('results');
  const feeValue = document.getElementById('feeValue');
  const feeSlab = document.getElementById('feeSlab');
  const copyBtn = document.getElementById('copyBtn');
  const copyFeedback = document.getElementById('copyFeedback');

  let feeRaw = 0;

  function clearErrorState() {
    if (errorMsg.textContent) {
      errorMsg.textContent = '';
      document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
    }
  }

  function showError(msg, field) {
    errorMsg.textContent = msg;
    document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
    if (field) field.classList.add('error');
    results.classList.remove('visible');
  }

  attachExpressionFormatter(amountInput, clearErrorState);
  attachExpressionFormatter(advocateMiscInput, clearErrorState);

  function doCalculate() {
    const v = evaluateExpression(amountInput.value);
    if (v === null) return showError('Enter an amount.', amountInput);
    if (isNaN(v) || !isFinite(v) || v <= 0) return showError('Amount must be positive.', amountInput);

    let advMisc = 0;
    const miscVal = evaluateExpression(advocateMiscInput.value);
    if (miscVal !== null) {
      if (isNaN(miscVal) || !isFinite(miscVal) || miscVal < 0)
        return showError('Advocate misc fees must be zero or positive.', advocateMiscInput);
      advMisc = Math.round(miscVal);
    }
    clearErrorState();

    const rounded = Math.round(v);
    const advocate = calculateAdvocateFee(rounded);
    const half = Math.round(advocate.fee / 2);
    const final = half + advMisc;
    feeRaw = final;

    feeValue.textContent = formatINR(final);

    let text = describeSlab(advocateSlabs, rounded);
    if (text) {
      text += '<br>Full ' + hl(advocate.fee) + ', half = ' + hl(half);
      if (advMisc > 0) text += ' + Advocate Misc ' + hl(advMisc) + ' = ' + hl(final);
    }
    if (text && advocate.minimumApplied) {
      text += '<br>Minimum ' + hl(500) + ' applied';
    }
    feeSlab.innerHTML = text;

    results.classList.add('visible');
    clearBtn.classList.add('visible');
  }

  function clearAll() {
    amountInput.value = '';
    advocateMiscInput.value = '';
    errorMsg.textContent = '';
    document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
    results.classList.remove('visible');
    clearBtn.classList.remove('visible');
    amountInput.focus();
  }

  calcBtn.addEventListener('click', doCalculate);
  clearBtn.addEventListener('click', clearAll);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      if (e.target === copyBtn) return;
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

  bindCopy(copyBtn, () => feeRaw, copyFeedback);

  amountInput.focus();
})();
