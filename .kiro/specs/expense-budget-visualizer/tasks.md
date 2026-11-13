# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side, single-page expense tracker using HTML, CSS, and Vanilla JavaScript. The implementation is broken into incremental steps — scaffolding first, then each JavaScript component in dependency order, followed by wiring and testing. All logic lives in `js/app.js`, all styling in `css/styles.css`, and the entry point is `index.html`.

## Tasks

- [x] 1. Set up project scaffolding and HTML structure
  - Create the `css/` and `js/` directories
  - Write `index.html` with semantic sections: `#header` (Balance_Display), `#transaction-form` (Input_Form), `#transaction-list` (Transaction_List), `#chart-container` (Chart), and `#toast` (banner)
  - Add the Chart.js 4.x CDN `<script>` tag via jsDelivr before the closing `</body>`
  - Add `<link>` to `css/styles.css` and `<script src="js/app.js" defer>` in `<head>`
  - Include `role="alert"` on `#toast` and appropriate `aria-label` attributes on form controls
  - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6_

- [x] 2. Write CSS layout and visual design
  - Implement a clean visual hierarchy with the Balance_Display, Input_Form, Transaction_List, and Chart each separated by visible borders or at least 16px whitespace
  - Set minimum font size of 14px for all body text and labels
  - Style the toast banner (bottom of viewport, `role="alert"`, red for errors, amber for warnings, hidden by default)
  - Style transaction list items with item name, formatted amount, category, and a delete button
  - Style the chart container and an empty-state placeholder text element inside it
  - _Requirements: 7.3, 7.4, 7.5_

- [x] 3. Implement core data structures and constants
  - [x] 3.1 Define the `STORAGE_KEY` constant (`"expense_budget_visualizer_v1"`) and the `CATEGORIES` array (`["Food", "Transport", "Fun"]`) in `js/app.js`
    - Define the in-memory `transactions` array as the single source of truth
    - _Requirements: 5.1, 6.1_

- [x] 4. Implement StorageManager
  - [x] 4.1 Write `StorageManager.isAvailable()`, `StorageManager.save(transactions)`, and `StorageManager.load()`
    - `isAvailable`: probe write/read/delete on localStorage; return boolean
    - `save`: JSON.stringify and setItem; throw on failure
    - `load`: getItem → null returns `[]`; JSON.parse; validate each entry's `id`, `name`, `amount`, `category` fields and types; return only well-formed entries; throw `ParseError` on SyntaxError and `SchemaWarning` when any entries are filtered
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 4.2 Write property test for StorageManager serialization round-trip
    - **Property 1: Transaction serialization round-trip**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Use fast-check to generate random arrays of well-formed Transaction objects; assert `StorageManager.load()` output equals the saved array in length, `id`, `name`, `amount`, and `category`

  - [ ]* 4.3 Write property test for malformed entry filtering
    - **Property 8: Malformed storage entries are silently filtered; well-formed entries are preserved**
    - **Validates: Requirements 5.5**
    - Use fast-check to generate mixed arrays of valid and structurally invalid entries; assert only well-formed entries are returned, in original order, with no mutation

  - [ ]* 4.4 Write unit tests for StorageManager
    - Test `load` with valid JSON, corrupt JSON, null, and partially invalid entries (mock `localStorage`)
    - Test `save` throwing when `setItem` throws
    - Test `isAvailable` returning false when localStorage is inaccessible

- [x] 5. Implement Validator
  - [x] 5.1 Write `Validator.isValidName(value)` and `Validator.isValidAmount(value)` pure functions, and `Validator.validate(name, amount, category)`
    - `isValidName`: non-empty after trim, ≤ 100 chars; return boolean
    - `isValidAmount`: numeric, 0.01 ≤ value ≤ 999,999,999.99, finite; return boolean
    - `validate`: call both; return `{ valid: boolean, errors: { name?: string, amount?: string } }`
    - _Requirements: 1.3, 1.4_

  - [ ]* 5.2 Write property test for whitespace and empty name rejection
    - **Property 2: Whitespace and empty names are always rejected**
    - **Validates: Requirements 1.3**
    - Use fast-check to generate strings of only whitespace chars and empty string; assert `Validator.isValidName` returns false for all

  - [ ]* 5.3 Write property test for out-of-range and non-numeric amount rejection
    - **Property 3: Out-of-range and non-numeric amounts are always rejected**
    - **Validates: Requirements 1.4**
    - Use fast-check to generate zero, negatives, values > 999,999,999.99, NaN, Infinity, and non-numeric strings; assert `Validator.isValidAmount` returns false for all

  - [ ]* 5.4 Write unit tests for Validator boundary values
    - Test `isValidName`: empty string, all-whitespace, length 1, length 100, length 101
    - Test `isValidAmount`: 0, 0.01, 999,999,999.99, 1,000,000,000, NaN, negative values

- [x] 6. Checkpoint — Ensure StorageManager and Validator pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement showToast and BalanceDisplay
  - [x] 7.1 Write `showToast(message, type)` where `type` is `'error'` or `'warning'`
    - Set `#toast` text content and CSS class; make it visible; auto-dismiss after 5 seconds
    - Ensure `role="alert"` is present for screen reader accessibility
    - _Requirements: 5.4, 5.5, 5.6, 2.6, 3.6_

  - [x] 7.2 Write `BalanceDisplay.render(transactions)`
    - Compute sum via `Array.reduce` over `tx.amount`
    - Format as currency string with `$` symbol and two decimal places (e.g., `$0.00`, `$1,234.56`)
    - Update the `#balance` text node
    - _Requirements: 3.1, 3.4_

  - [ ]* 7.3 Write property test for balance equals arithmetic sum
    - **Property 4: Balance equals the arithmetic sum of all transaction amounts**
    - **Validates: Requirements 3.1, 3.4**
    - Use fast-check to generate random arrays of valid Transaction objects (including empty); assert the rendered balance text equals `$` + sum formatted to two decimals

  - [ ]* 7.4 Write unit tests for BalanceDisplay formatting
    - Test output for $0.00, $1.00, $1,234.56, and a large value with comma separators

- [x] 8. Implement TransactionList
  - [x] 8.1 Write `TransactionList.render(transactions)`
    - Clear `#transaction-list`; if empty, show placeholder message per Requirement 2.4
    - For each transaction create an `<li>` with item name, amount formatted with currency symbol and two decimal places, category, and a delete button carrying `data-id`
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 8.2 Write `TransactionList.onDelete(id)` using event delegation on `#transaction-list`
    - Splice the transaction from the in-memory `transactions` array by `id`
    - Call `StorageManager.save`; on failure call `showToast` with `'error'` and re-insert the transaction; on success call `render()`
    - _Requirements: 2.3, 2.7, 5.2_

  - [ ]* 8.3 Write property test for delete reduces list by exactly one
    - **Property 6: Deleting a transaction reduces the list by exactly one and updates all displays**
    - **Validates: Requirements 2.3, 3.3, 4.3**
    - Use fast-check to generate a transaction array of length ≥ 1 and a random valid index; assert post-delete length is N−1, the deleted entry is absent, and BalanceDisplay reflects the recalculated sum

  - [ ]* 8.4 Write unit tests for TransactionList
    - Test render with empty array (placeholder visible)
    - Test render with multiple transactions (each `<li>` has correct text and delete button)
    - Test delete dispatches the correct `data-id`

- [x] 9. Implement ChartManager
  - [x] 9.1 Write `ChartManager.init()` and `ChartManager.render(transactions)`
    - `init`: check `window.Chart`; if absent set `chartAvailable = false` and show fallback message in `#chart-container`; else create `new Chart(ctx, { type: 'pie', ... })` and set `chartAvailable = true`
    - `render`: if `!chartAvailable` return; compute per-category totals; if all zero show placeholder text and hide canvas; else show canvas, update `chart.data.datasets[0].data` and `chart.data.labels` for non-zero categories only, call `chart.update()`
    - _Requirements: 4.1, 4.4, 4.5, 6.7_

  - [ ]* 9.2 Write property test for pie chart proportional category totals
    - **Property 5: Pie chart data reflects proportional category totals**
    - **Validates: Requirements 4.1, 4.4**
    - Use fast-check to generate random non-empty transaction arrays across 1–3 categories; assert only categories with total > 0 appear as segments, each segment value equals that category's total, and all segment values sum to the total of all amounts

  - [ ]* 9.3 Write unit tests for ChartManager
    - Test `render` with empty transactions (canvas hidden, placeholder shown)
    - Test `render` with one category (single segment)
    - Test `render` with all three categories (three segments with correct values)
    - Test `init` when `window.Chart` is undefined (fallback message rendered, `chartAvailable = false`)

- [x] 10. Implement FormController
  - [x] 10.1 Write `FormController` binding the `submit` event on `#transaction-form`
    - Read item name, amount, and category field values
    - Call `Validator.validate`; on failure display inline error messages adjacent to invalid fields; on success clear inline errors
    - On success: generate `id` via `crypto.randomUUID()` (fallback `Date.now().toString()`); push new Transaction to `transactions`; call `StorageManager.save`; on storage failure call `showToast('error')` and preserve field values per Requirement 1.6; on storage success reset the form (name and amount to `""`, category to `"Food"`) and call `render()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 10.2 Write property test for form reset after successful submission
    - **Property 7: Form resets to its initial state after every successful submission**
    - **Validates: Requirements 1.5**
    - Use fast-check to generate random valid (name, amount, category) triples; assert after each successful submission the name field is `""`, amount field is `""`, and category dropdown selected value is `"Food"`

  - [ ]* 10.3 Write unit tests for FormController
    - Test submit with all empty fields (inline errors shown for name and amount)
    - Test submit with invalid amount (inline error on amount only)
    - Test submit with valid data (transaction added, form reset, `StorageManager.save` called)
    - Test submit when `StorageManager.save` throws (toast shown, field values preserved)

- [x] 11. Checkpoint — Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Wire all components and implement app initialization
  - [x] 12.1 Write the top-level `render()` function that calls `TransactionList.render(transactions)`, `BalanceDisplay.render(transactions)`, and `ChartManager.render(transactions)` in sequence
    - _Requirements: 3.2, 3.3, 4.2, 4.3_

  - [x] 12.2 Write the `init()` function that runs on `DOMContentLoaded`
    - Check `StorageManager.isAvailable()`; if unavailable call `showToast('warning')` and initialize with empty list
    - Try `StorageManager.load()`; on `ParseError` call `showToast('warning')` and initialize empty; on `SchemaWarning` call `showToast('warning')` and use the filtered list
    - Assign the loaded (or empty) array to `transactions`
    - Call `ChartManager.init()` then `render()`
    - Attach `FormController` submit listener and `TransactionList` delete delegation
    - _Requirements: 2.5, 2.6, 3.5, 3.6, 4.6, 5.3, 5.4, 5.5_

  - [ ]* 12.3 Write integration tests for full add → persist → reload → restore flow
    - Simulate form submission, verify `localStorage` contains the entry, reload (re-run `init`), verify Transaction_List and BalanceDisplay reflect the persisted data
    - _Requirements: 5.1, 5.3_

  - [ ]* 12.4 Write integration tests for add → delete → reload → absent flow
    - Add a transaction, delete it, re-run `init`, verify Transaction_List shows placeholder
    - _Requirements: 5.2, 5.3_

  - [ ]* 12.5 Write integration test for CDN failure path
    - Unset `window.Chart` before calling `ChartManager.init()`; verify fallback message renders and no uncaught errors occur; verify form, list, and balance still work
    - _Requirements: 6.7_

  - [ ]* 12.6 Write integration test for storage write failure
    - Mock `localStorage.setItem` to throw; submit a transaction; verify toast appears and in-memory change is reflected in the UI
    - _Requirements: 1.6, 5.6_

- [x] 13. Final checkpoint — Ensure all tests pass and UI is functional
  - Ensure all tests pass, ask the user if questions arise.
  - Open `index.html` directly from the file system and manually verify: LocalStorage reads/writes, pie chart renders, form submission and delete, responsive layout at ≥14px fonts, and toast appearance for error and warning scenarios.
  - _Requirements: 6.4, 6.6, 7.1, 7.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of core logic before wiring
- Property tests (fast-check) validate universal invariants across randomly generated inputs; each runs ≥ 100 iterations
- Unit tests cover boundary values and error branches; integration tests verify storage and CDN failure paths end-to-end
- No build step, server, or package manager is needed — open `index.html` directly in the browser

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1"] },
    { "id": 1, "tasks": ["4.1", "5.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "4.4", "5.2", "5.3", "5.4"] },
    { "id": 3, "tasks": ["7.1", "7.2", "8.1"] },
    { "id": 4, "tasks": ["7.3", "7.4", "8.2"] },
    { "id": 5, "tasks": ["8.3", "8.4", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 7, "tasks": ["10.2", "10.3"] },
    { "id": 8, "tasks": ["12.1"] },
    { "id": 9, "tasks": ["12.2"] },
    { "id": 10, "tasks": ["12.3", "12.4", "12.5", "12.6"] }
  ]
}
```
