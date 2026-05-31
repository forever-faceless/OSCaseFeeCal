(function () {
  'use strict';

  const {
    courtSlabs, calculateCourtFee, describeSlab,
    formatINR, hl, attachExpressionFormatter, evaluateExpression, bindCopy
  } = window.lib;

  const amountInput = document.getElementById('amount');
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
      amountInput.classList.remove('error');
    }
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    amountInput.classList.add('error');
    results.classList.remove('visible');
  }

  attachExpressionFormatter(amountInput, clearErrorState);

  function doCalculate() {
    const v = evaluateExpression(amountInput.value);
    if (v === null) return showError('Enter an amount.');
    if (isNaN(v) || !isFinite(v) || v <= 0) return showError('Amount must be positive.');
    clearErrorState();

    const rounded = Math.round(v);
    const court = calculateCourtFee(rounded);
    feeRaw = court.fee;

    feeValue.textContent = formatINR(court.fee);
    feeSlab.innerHTML = describeSlab(courtSlabs, rounded) + '<br>Computed on ' + hl(rounded);

    results.classList.add('visible');
    clearBtn.classList.add('visible');
  }

  function clearAll() {
    amountInput.value = '';
    errorMsg.textContent = '';
    amountInput.classList.remove('error');
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
