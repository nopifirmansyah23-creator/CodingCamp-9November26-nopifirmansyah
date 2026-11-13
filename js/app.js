// Expense & Budget Visualizer — app.js

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** LocalStorage key used to persist all transactions. Fixed across sessions. */
const STORAGE_KEY = 'expense_budget_visualizer_v1';

/** Predefined spending categories available to the user. */
const CATEGORIES = ['Food', 'Transport', 'Fun'];

// ─────────────────────────────────────────────
// Application State
// ─────────────────────────────────────────────

/**
 * Single source of truth for all transactions held in memory.
 * Kept in sync with LocalStorage on every mutation.
 * @type {Array<{id: string, name: string, amount: number, category: string}>}
 */
let transactions = [];

// ─────────────────────────────────────────────
// Custom Error Classes
// ─────────────────────────────────────────────

/** Thrown when JSON.parse fails on the stored data. */
class ParseError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ParseError';
  }
}

/**
 * Thrown when the parsed JSON contains entries that fail schema validation.
 * The valid (filtered) entries are attached as `this.validEntries` so the
 * caller can still use them after catching.
 */
class SchemaWarning extends Error {
  constructor(msg, validEntries) {
    super(msg);
    this.name = 'SchemaWarning';
    this.validEntries = validEntries;
  }
}

/** Thrown when a LocalStorage write operation fails. */
class StorageError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'StorageError';
  }
}

// ─────────────────────────────────────────────
// StorageManager
// ─────────────────────────────────────────────

/**
 * Encapsulates all LocalStorage interactions.
 * Keeps the rest of the app decoupled from browser storage details.
 */
const StorageManager = {
  /**
   * Probes LocalStorage with a write / read / delete cycle.
   * @returns {boolean} `true` when LocalStorage is accessible, `false` otherwise.
   */
  isAvailable() {
    const probeKey = '__storage_probe__';
    try {
      localStorage.setItem(probeKey, '1');
      localStorage.getItem(probeKey);
      localStorage.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Serialises the transaction array to JSON and writes it to LocalStorage.
   * @param {Array<{id: string, name: string, amount: number, category: string}>} transactions
   * @throws {StorageError} when the write fails for any reason.
   */
  save(transactions) {
    try {
      const json = JSON.stringify(transactions);
      localStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
      throw new StorageError(`Failed to save transactions: ${err.message}`);
    }
  },

  /**
   * Reads and deserialises the transaction array from LocalStorage.
   *
   * - Returns `[]` when no data exists yet.
   * - Throws `ParseError` when the stored JSON is corrupt.
   * - Throws `SchemaWarning` (with valid entries attached) when some entries
   *   fail schema validation — the caller should use `err.validEntries`.
   *
   * @returns {Array<{id: string, name: string, amount: number, category: string}>}
   * @throws {ParseError|SchemaWarning}
   */
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);

    // Nothing stored yet — fresh start.
    if (raw === null) {
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ParseError('Stored data is not valid JSON and could not be loaded.');
    }

    // Guard against non-array top-level values.
    if (!Array.isArray(parsed)) {
      throw new ParseError('Stored data has an unexpected format and could not be loaded.');
    }

    // Validate each entry against the Transaction schema.
    const valid = parsed.filter((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      if (typeof entry.id !== 'string' || entry.id.trim() === '') return false;
      if (typeof entry.name !== 'string' || entry.name.trim() === '') return false;
      if (typeof entry.amount !== 'number' || !isFinite(entry.amount) || entry.amount <= 0) return false;
      if (!CATEGORIES.includes(entry.category)) return false;
      return true;
    });

    // If any entries were filtered out, return valid ones via SchemaWarning.
    if (valid.length !== parsed.length) {
      throw new SchemaWarning(
        'Some saved entries were invalid and have been ignored.',
        valid
      );
    }

    return valid;
  },
};

// ─────────────────────────────────────────────
// Validator
// ─────────────────────────────────────────────

/**
 * Pure validation functions for transaction form fields.
 * No DOM interaction — returns plain result objects so callers decide
 * how to present errors.
 */
const Validator = {
  /**
   * Returns `true` when `value` is a non-empty string after trimming and
   * is at most 100 characters long.
   * @param {string} value
   * @returns {boolean}
   */
  isValidName(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
  },

  /**
   * Returns `true` when `value` is a finite number (or a string that
   * converts to one) that falls within the range [0.01, 999_999_999.99].
   * Rejects zero, negatives, NaN, Infinity, and non-numeric strings.
   * @param {string|number} value
   * @returns {boolean}
   */
  isValidAmount(value) {
    // Allow numeric strings by converting; reject blank / whitespace-only.
    if (typeof value === 'string' && value.trim() === '') return false;
    const num = Number(value);
    if (!isFinite(num) || isNaN(num)) return false;
    return num >= 0.01 && num <= 999_999_999.99;
  },

  /**
   * Validates all three transaction fields together.
   *
   * @param {string}        name      - Item name entered by the user.
   * @param {string|number} amount    - Amount entered by the user.
   * @param {string}        category  - Category selected by the user.
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string } }}
   */
  validate(name, amount, category) {
    const errors = {};

    if (!this.isValidName(name)) {
      errors.name = 'Item name is required and must be 1–100 characters.';
    }

    if (!this.isValidAmount(amount)) {
      errors.amount = 'Amount must be a number between 0.01 and 999,999,999.99.';
    }

    // Category is validated against the fixed list; no user-visible error
    // message is needed here because the dropdown always has a valid default.
    if (!CATEGORIES.includes(category)) {
      errors.category = 'Please select a valid category (Food, Transport, or Fun).';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  },
};

// ─────────────────────────────────────────────
// Toast / Error Banner
// ─────────────────────────────────────────────

/**
 * Displays a non-blocking toast banner at the bottom of the viewport.
 *
 * The `#toast` element already carries `role="alert"` and `aria-live="assertive"`
 * in the HTML, so screen readers will announce the message automatically when
 * the element's text content changes — no extra ARIA manipulation needed here.
 *
 * @param {string} message - The human-readable message to display.
 * @param {'error'|'warning'} type - Visual style: red for errors, amber for warnings.
 */
function showToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Clear any previous type classes before applying the new one.
  toast.classList.remove('toast-error', 'toast-warning', 'hidden');

  toast.textContent = message;
  toast.classList.add(type === 'warning' ? 'toast-warning' : 'toast-error');

  // Cancel any in-flight auto-dismiss timer so back-to-back calls don't
  // hide the new toast prematurely.
  if (showToast._timerId) {
    clearTimeout(showToast._timerId);
  }

  // Auto-dismiss after 5 seconds (Requirements 5.4, 5.5, 5.6, 2.6, 3.6).
  showToast._timerId = setTimeout(() => {
    toast.classList.add('hidden');
    showToast._timerId = null;
  }, 5000);
}

// ─────────────────────────────────────────────
// BalanceDisplay
// ─────────────────────────────────────────────

/**
 * Owns the #balance DOM element and re-renders it whenever the
 * transaction list changes.
 */
const BalanceDisplay = {
  /**
   * Computes the total of all transaction amounts and writes it to
   * the #balance element as a formatted currency string.
   *
   * - Empty array → "$0.00"
   * - Non-zero values → "$1,234.56" (comma thousands separator, two decimal places)
   *
   * @param {Array<{id: string, name: string, amount: number, category: string}>} transactions
   */
  render(transactions) {
    const sum = transactions.reduce((acc, tx) => acc + tx.amount, 0);

    // toLocaleString with explicit locale + options guarantees the
    // "en-US" comma-thousands format required by the spec.
    const formatted =
      '$' +
      sum.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const balanceEl = document.getElementById('balance');
    if (balanceEl) {
      balanceEl.textContent = formatted;
    }
  },
};

// ─────────────────────────────────────────────
// TransactionList
// ─────────────────────────────────────────────

/**
 * Owns the #transaction-list DOM element and re-renders it whenever the
 * transaction array changes.
 */
const TransactionList = {
  /**
   * Clears and re-renders the #transaction-list element.
   *
   * - When `transactions` is empty, the placeholder message is shown
   *   (Requirement 2.4).
   * - Otherwise, one <li> is created per transaction containing the item name,
   *   amount formatted with a "$" currency symbol and two decimal places,
   *   the category, and a delete button that carries a `data-id` attribute
   *   (Requirements 2.1, 2.2).
   *
   * @param {Array<{id: string, name: string, amount: number, category: string}>} transactions
   */
  render(transactions) {
    const list = document.getElementById('transaction-list');
    if (!list) return;

    // Clear all existing children (including any previous placeholder).
    list.innerHTML = '';

    if (transactions.length === 0) {
      // Requirement 2.4 — show placeholder when the list is empty.
      const placeholder = document.createElement('li');
      placeholder.id = 'list-placeholder';
      placeholder.className = 'placeholder';
      placeholder.textContent = 'No expenses recorded yet.';
      list.appendChild(placeholder);
      return;
    }

    transactions.forEach((tx) => {
      const li = document.createElement('li');
      li.className = 'transaction-item';
      li.dataset.id = tx.id;

      // ── Item name ──────────────────────────────────────────────────────
      const nameSpan = document.createElement('span');
      nameSpan.className = 'tx-name';
      nameSpan.textContent = tx.name;

      // ── Formatted amount ───────────────────────────────────────────────
      // Currency symbol + two decimal places with comma thousands separator
      // (e.g. "$1,234.56"), matching the BalanceDisplay format (Requirement 2.1).
      const amountSpan = document.createElement('span');
      amountSpan.className = 'tx-amount';
      amountSpan.textContent =
        '$' +
        tx.amount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      // ── Category ───────────────────────────────────────────────────────
      const categorySpan = document.createElement('span');
      categorySpan.className = 'tx-category';
      categorySpan.dataset.category = tx.category; // required for CSS badge colour rules
      categorySpan.textContent = tx.category;

      // ── Delete button ──────────────────────────────────────────────────
      // The `data-id` attribute is read by TransactionList.onDelete via
      // event delegation to identify which transaction to remove.
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-delete';
      deleteBtn.dataset.id = tx.id;
      deleteBtn.setAttribute('aria-label', `Delete expense: ${tx.name}`);
      deleteBtn.textContent = 'Delete';

      li.appendChild(nameSpan);
      li.appendChild(amountSpan);
      li.appendChild(categorySpan);
      li.appendChild(deleteBtn);

      list.appendChild(li);
    });
  },

  /**
   * Handles deletion of a transaction identified by `id`.
   *
   * - Splices the transaction out of the in-memory `transactions` array.
   * - Attempts to persist the change via `StorageManager.save`.
   *   - On success: triggers a full re-render.
   *   - On failure (`StorageError`): shows an error toast and re-inserts the
   *     transaction at its original index so the UI stays consistent with
   *     storage (Requirements 2.3, 2.7, 5.2).
   *
   * This method is not called directly — it is invoked from the event
   * delegation listener registered below by `TransactionList.init()`.
   *
   * @param {string} id - The `id` of the transaction to delete.
   */
  onDelete(id) {
    // Find the transaction and remember its position for rollback.
    const index = transactions.findIndex((tx) => tx.id === id);
    if (index === -1) return; // Guard: transaction already gone.

    // Remove from in-memory array.
    const [removed] = transactions.splice(index, 1);

    try {
      StorageManager.save(transactions);
      // Persist succeeded — reflect the change in every display component.
      render();
    } catch {
      // Persist failed — roll back the splice so memory and storage stay in sync.
      transactions.splice(index, 0, removed);
      showToast('Failed to delete expense. Please try again.', 'error');
    }
  },

  /**
   * Registers the event delegation listener on `#transaction-list`.
   * Clicks on any element with `class="btn-delete"` and a `data-id`
   * attribute are routed to `TransactionList.onDelete`.
   *
   * Called once during app initialisation.
   */
  init() {
    const list = document.getElementById('transaction-list');
    if (!list) return;

    list.addEventListener('click', (event) => {
      const btn = event.target.closest('.btn-delete[data-id]');
      if (!btn) return;
      TransactionList.onDelete(btn.dataset.id);
    });
  },
};

// ─────────────────────────────────────────────
// ChartManager
// ─────────────────────────────────────────────

/**
 * Whether Chart.js was successfully loaded from the CDN.
 * Set once during `ChartManager.init()` and never changed afterwards.
 * @type {boolean}
 */
let chartAvailable = false;

/**
 * The Chart.js instance created by `ChartManager.init()`.
 * `null` until initialisation succeeds.
 * @type {Chart|null}
 */
let chart = null;

/**
 * Owns the `#chart-container` DOM region: initialises the Chart.js instance
 * on page load and re-renders chart data whenever the transaction list changes.
 *
 * Requirements: 4.1, 4.4, 4.5, 6.7
 */
const ChartManager = {
  /**
   * Checks for the Chart.js global and either creates the pie chart or
   * renders a CDN-failure fallback message.
   *
   * - If `window.Chart` is absent (CDN failed to load):
   *     - Sets `chartAvailable = false`.
   *     - Hides the canvas and shows a fallback message inside
   *       `#chart-container` (Requirement 6.7).
   * - If `window.Chart` is present:
   *     - Creates a `new Chart(ctx, { type: 'pie', … })` with empty initial
   *       data so `ChartManager.render()` can populate it lazily.
   *     - Sets `chartAvailable = true`.
   *
   * Called once during app initialisation, before the first `render()`.
   */
  init() {
    const canvas      = document.getElementById('expense-chart');
    const container   = document.getElementById('chart-container');
    const placeholder = document.getElementById('chart-placeholder');

    if (!window.Chart) {
      // CDN failed — degrade gracefully (Requirement 6.7).
      chartAvailable = false;

      if (canvas)    canvas.style.display = 'none';

      if (placeholder) {
        placeholder.textContent = 'Chart unavailable — charting library failed to load.';
        placeholder.style.display = '';
      } else if (container) {
        // Fallback: inject a message directly into the container.
        const msg = document.createElement('p');
        msg.id        = 'chart-unavailable';
        msg.className = 'placeholder';
        msg.textContent = 'Chart unavailable — charting library failed to load.';
        container.appendChild(msg);
      }
      return;
    }

    // Chart.js is available — create the pie chart instance.
    chartAvailable = true;

    if (!canvas) return; // Guard: canvas element missing from DOM.

    const ctx = canvas.getContext('2d');

    chart = new window.Chart(ctx, {
      type: 'pie',
      data: {
        labels:   [],
        datasets: [
          {
            data:            [],
            backgroundColor: [
              '#4e79a7', // Food    — steel blue
              '#f28e2b', // Transport — orange
              '#59a14f', // Fun    — green
            ],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          },
          tooltip: {
            callbacks: {
              /**
               * Show dollar-formatted values in the tooltip
               * (e.g. "$42.00") rather than raw numbers.
               */
              label(context) {
                const value = context.parsed;
                const formatted =
                  '$' +
                  value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                return ` ${context.label}: ${formatted}`;
              },
            },
          },
        },
      },
    });
  },

  /**
   * Re-renders the pie chart based on the current transaction list.
   *
   * - Returns immediately when `chartAvailable` is `false` (CDN failure path).
   * - Computes the total amount for each category in `CATEGORIES`.
   * - If all category totals are zero (no transactions):
   *     - Hides the canvas.
   *     - Shows `#chart-placeholder` (Requirement 4.5).
   * - Otherwise (at least one category has spending):
   *     - Filters to categories with a total > 0 (Requirements 4.1, 4.4).
   *     - Updates `chart.data.labels` and `chart.data.datasets[0].data`.
   *     - Calls `chart.update()` to repaint.
   *     - Shows the canvas and hides the placeholder.
   *
   * @param {Array<{id: string, name: string, amount: number, category: string}>} transactions
   */
  render(transactions) {
    if (!chartAvailable) return;

    const canvas      = document.getElementById('expense-chart');
    const placeholder = document.getElementById('chart-placeholder');

    // Compute per-category totals in CATEGORIES order.
    const totals = CATEGORIES.map((cat) =>
      transactions
        .filter((tx) => tx.category === cat)
        .reduce((sum, tx) => sum + tx.amount, 0)
    );

    const allZero = totals.every((t) => t === 0);

    if (allZero) {
      // No spending data — show placeholder, hide canvas (Requirement 4.5).
      if (canvas)      canvas.style.display = 'none';
      if (placeholder) placeholder.style.display = '';
      return;
    }

    // Filter to non-zero categories only (Requirements 4.1, 4.4).
    const activeLabels = [];
    const activeData   = [];

    CATEGORIES.forEach((cat, i) => {
      if (totals[i] > 0) {
        activeLabels.push(cat);
        activeData.push(totals[i]);
      }
    });

    // Update chart data and repaint.
    chart.data.labels                  = activeLabels;
    chart.data.datasets[0].data        = activeData;
    chart.update();

    // Show canvas, hide placeholder.
    if (canvas)      canvas.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
  },
};

// ─────────────────────────────────────────────
// FormController
// ─────────────────────────────────────────────

/**
 * Owns the `#transaction-form` DOM element. Binds the `submit` event,
 * reads field values, calls `Validator`, displays inline errors, and—on
 * success—appends a new Transaction to the `transactions` array, persists
 * via `StorageManager`, then resets the form and triggers a full render.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
const FormController = {
  /**
   * Registers the `submit` event listener on `#transaction-form`.
   * Called once during app initialisation.
   */
  init() {
    const form = document.getElementById('transaction-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      FormController.onSubmit();
    });
  },

  /**
   * Handles the form submission lifecycle:
   *
   * 1. Reads the current values of `#item-name`, `#amount`, and `#category`.
   * 2. Runs `Validator.validate` on them.
   * 3. On validation failure:
   *    - Populates inline error elements (`#item-name-error`, `#amount-error`)
   *      with the respective messages (Requirements 1.3, 1.4).
   * 4. On validation success:
   *    - Clears all inline error messages.
   *    - Generates a unique `id` via `crypto.randomUUID()` (falls back to
   *      `Date.now().toString()` when the API is unavailable).
   *    - Pushes the new Transaction object onto the `transactions` array.
   *    - Calls `StorageManager.save(transactions)`.
   *      - On storage failure: shows an error toast and does NOT reset the
   *        form, leaving the user's entered values intact (Requirement 1.6).
   *      - On storage success: resets `#item-name` and `#amount` to `""`,
   *        resets `#category` to `"Food"`, then calls `render()` (Requirement 1.5).
   */
  onSubmit() {
    const nameInput     = document.getElementById('item-name');
    const amountInput   = document.getElementById('amount');
    const categoryInput = document.getElementById('category');

    const nameValue     = nameInput   ? nameInput.value   : '';
    const amountValue   = amountInput ? amountInput.value : '';
    const categoryValue = categoryInput ? categoryInput.value : '';

    const { valid, errors } = Validator.validate(nameValue, amountValue, categoryValue);

    // Always update (or clear) the inline error elements.
    const nameError   = document.getElementById('item-name-error');
    const amountError = document.getElementById('amount-error');

    if (nameError)   nameError.textContent   = errors.name   || '';
    if (amountError) amountError.textContent = errors.amount || '';

    if (!valid) {
      // Validation failed — keep the form values untouched and bail out.
      return;
    }

    // ── Validation passed ──────────────────────────────────────────────

    // Generate a unique ID, falling back when crypto is unavailable.
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString();

    const newTransaction = {
      id,
      name:     nameValue.trim(),
      amount:   Number(amountValue),
      category: categoryValue,
    };

    // Add to in-memory list.
    transactions.push(newTransaction);

    try {
      StorageManager.save(transactions);

      // Persist succeeded — reset form and re-render (Requirement 1.5).
      if (nameInput)     nameInput.value       = '';
      if (amountInput)   amountInput.value     = '';
      if (categoryInput) categoryInput.value   = 'Food';

      // Clear any residual inline errors after a clean save.
      if (nameError)   nameError.textContent   = '';
      if (amountError) amountError.textContent = '';

      render();
    } catch {
      // Persist failed — roll back the push so memory and storage stay in sync,
      // show an error toast, and leave the field values intact (Requirement 1.6).
      transactions.pop();
      showToast(
        'Failed to save expense. Please try again.',
        'error'
      );
    }
  },
};

// ─────────────────────────────────────────────
// Top-level render()
// ─────────────────────────────────────────────

/**
 * Coordinates a full re-render of every display component using the current
 * in-memory `transactions` array as the single source of truth.
 *
 * Called after every mutation (add, delete) and on initial load.
 */
function render() {
  TransactionList.render(transactions);
  BalanceDisplay.render(transactions);
  ChartManager.render(transactions);
}

// ─────────────────────────────────────────────
// App Initialisation
// ─────────────────────────────────────────────

/**
 * Entry point. Runs once when the DOM is ready (via `defer` on the script tag).
 *
 * Sequence:
 * 1. Check LocalStorage availability.
 * 2. Load persisted transactions (handling errors gracefully).
 * 3. Initialise all stateful components (chart, list delegate, form listener).
 * 4. Run the initial render pass.
 */
function init() {
  // ── 1. LocalStorage availability check ───────────────────────────────
  if (!StorageManager.isAvailable()) {
    showToast(
      'Local storage is unavailable. Your data will not be saved between sessions.',
      'warning'
    );
    // Continue with an empty list; storage writes will silently fail later.
  } else {
    // ── 2. Load persisted data ──────────────────────────────────────────
    try {
      transactions = StorageManager.load();
    } catch (err) {
      if (err.name === 'SchemaWarning') {
        // Some entries were invalid but valid ones were recovered.
        transactions = err.validEntries;
        showToast(err.message, 'warning');
      } else {
        // ParseError or anything else — start fresh.
        transactions = [];
        showToast(err.message, 'warning');
      }
    }
  }

  // ── 3. Initialise components ──────────────────────────────────────────
  ChartManager.init();       // must come before first render() call
  TransactionList.init();    // sets up delete event delegation
  FormController.init();     // binds the form submit handler

  // ── 4. Initial render ─────────────────────────────────────────────────
  render();
}

// Kick off the app once the DOM is fully parsed.
// (The <script defer> in index.html ensures this runs after DOMContentLoaded.)
init();
