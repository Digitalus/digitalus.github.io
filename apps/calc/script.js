(function () {
  const display = document.getElementById('display');
  const history = document.getElementById('history');
  const keys = document.querySelector('.calc__pad');

  let current = '0';
  let previous = null;
  let operator = null;
  let justEvaluated = false;

  const MAX_DIGITS = 12;

  function updateDisplay() {
    display.textContent = current;
    history.textContent = previous !== null && operator
      ? `${previous} ${operator}`
      : '';
  }

  function inputDigit(digit) {
    if (justEvaluated) {
      current = digit;
      justEvaluated = false;
    } else if (current === '0') {
      current = digit;
    } else if (current.replace(/[-.]/g, '').length < MAX_DIGITS) {
      current += digit;
    }
  }

  function inputDecimal() {
    if (justEvaluated) {
      current = '0.';
      justEvaluated = false;
      return;
    }
    if (!current.includes('.')) {
      current += '.';
    }
  }

  function clearAll() {
    current = '0';
    previous = null;
    operator = null;
    justEvaluated = false;
  }

  function toggleSign() {
    if (current === '0') return;
    current = current.startsWith('-') ? current.slice(1) : '-' + current;
  }

  function applyPercent() {
    current = String(parseFloat(current) / 100);
  }

  function compute(a, b, op) {
    const x = parseFloat(a);
    const y = parseFloat(b);
    switch (op) {
      case '+': return x + y;
      case '−': return x - y;
      case '×': return x * y;
      case '÷': return y === 0 ? NaN : x / y;
      default: return y;
    }
  }

  function formatResult(num) {
    if (Number.isNaN(num)) return 'Error';
    let str = String(Math.round(num * 1e10) / 1e10);
    if (str.replace(/[-.]/g, '').length > MAX_DIGITS) {
      str = num.toExponential(5);
    }
    return str;
  }

  function chooseOperator(op) {
    if (operator && !justEvaluated) {
      const result = compute(previous, current, operator);
      current = formatResult(result);
    }
    previous = current;
    operator = op;
    justEvaluated = true; // next digit starts fresh
  }

  function evaluate() {
    if (operator === null || previous === null) return;
    const result = compute(previous, current, operator);
    current = formatResult(result);
    previous = null;
    operator = null;
    justEvaluated = true;
  }

  keys.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;

    if (btn.dataset.num !== undefined) {
      inputDigit(btn.dataset.num);
    } else if (btn.dataset.action === 'decimal') {
      inputDecimal();
    } else if (btn.dataset.action === 'clear') {
      clearAll();
    } else if (btn.dataset.action === 'sign') {
      toggleSign();
    } else if (btn.dataset.action === 'percent') {
      applyPercent();
    } else if (btn.dataset.action === 'operator') {
      chooseOperator(btn.dataset.op);
    } else if (btn.dataset.action === 'equals') {
      evaluate();
    }

    updateDisplay();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') {
      inputDigit(e.key);
    } else if (e.key === '.') {
      inputDecimal();
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      evaluate();
    } else if (e.key === 'Backspace') {
      current = current.length > 1 ? current.slice(0, -1) : '0';
    } else if (e.key === 'Escape') {
      clearAll();
    } else if (['+', '-', '*', '/'].includes(e.key)) {
      const map = { '+': '+', '-': '−', '*': '×', '/': '÷' };
      chooseOperator(map[e.key]);
    } else {
      return;
    }
    updateDisplay();
  });

  updateDisplay();
})();
