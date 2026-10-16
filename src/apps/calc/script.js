/*! Copyright (c) 2025-2026 Digitalus Maximus. All rights reserved. https://digitalus.github.io */
(function () {
  const display = document.getElementById('display');
  const history = document.getElementById('history');
  const keys = document.querySelector('.calc__pad');

  let current = '0';
  let previous = null;
  let operator = null;
  let justEvaluated = false;

  const MAX_DIGITS = 12;

  /** Shows the current value on the screen and the pending operation in the history line. */
  function updateDisplay() {
    display.textContent = current;
    history.textContent = previous !== null && operator
      ? `${previous} ${operator}`
      : '';
  }

  /**
   * Adds a digit to the current number. Starts a fresh number after a result,
   * replaces a lone zero, and stops at the maximum digit count.
   * @param {string} digit - A single character from '0' to '9'.
   */
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

  /** Adds a decimal point to the current number, ignoring it if one is already present. */
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

  /** Resets the calculator to its starting state (C button and Esc key). */
  function clearAll() {
    current = '0';
    previous = null;
    operator = null;
    justEvaluated = false;
  }

  /** Flips the current number between positive and negative (zero is left alone). */
  function toggleSign() {
    if (current === '0') return;
    current = current.startsWith('-') ? current.slice(1) : '-' + current;
  }

  /** Converts the current number to a percentage by dividing it by 100. */
  function applyPercent() {
    current = String(parseFloat(current) / 100);
  }

  /**
   * Applies an arithmetic operator to two numbers.
   * @param {string} a - Left operand.
   * @param {string} b - Right operand.
   * @param {string} op - One of + − × ÷.
   * @returns {number} The result, or NaN when dividing by zero.
   */
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

  /**
   * Turns a result into display text: rounds away floating point noise,
   * shows 'Error' for NaN, and switches to exponential notation when too long.
   * @param {number} num - The computed result.
   * @returns {string}
   */
  function formatResult(num) {
    if (Number.isNaN(num)) return 'Error';
    let str = String(Math.round(num * 1e10) / 1e10);
    if (str.replace(/[-.]/g, '').length > MAX_DIGITS) {
      str = num.toExponential(5);
    }
    return str;
  }

  /**
   * Stores the chosen operator. If an operation is already pending, it is
   * calculated first so operators can be chained (for example 2 + 3 × 4).
   * @param {string} op - One of + − × ÷.
   */
  function chooseOperator(op) {
    if (operator && !justEvaluated) {
      const result = compute(previous, current, operator);
      current = formatResult(result);
    }
    previous = current;
    operator = op;
    justEvaluated = true; // next digit starts fresh
  }

  /** Calculates the pending operation and shows the result (= button and Enter key). */
  function evaluate() {
    if (operator === null || previous === null) return;
    const result = compute(previous, current, operator);
    current = formatResult(result);
    previous = null;
    operator = null;
    justEvaluated = true;
  }

  // Handles on-screen button clicks, using the data-* attributes to decide what each key does.
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

  // Handles keyboard input: digits, decimal point, operators, Enter/=, Backspace, and Esc.
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
