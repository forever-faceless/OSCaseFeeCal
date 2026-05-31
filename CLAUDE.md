# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Static multi-page web app under the Karnataka Court Fees & Suits Valuation Act, 1958 (Rule 100, Karnataka Civil Rules). No build system, no package manager, no tests, no dependencies. To run, open any `*.html` in a browser (or serve the directory with any static server, e.g. `python -m http.server`).

Files:
- `index.html` + `app.js` — **OS Case calculator** (multi-account, per-account misc, advocate misc, print sheet).
- `court-fee.html` + `court-fee.js` — standalone **Court Fee calculator** (one amount → court fee).
- `advocate-fee.html` + `advocate-fee.js` — standalone **Advocate Fee calculator** (amount + advocate misc → ½ slab fee + misc).
- `lib.js` — shared library: slab tables, calculation functions, formatters, input handlers, copy-button helper. Exposed as `window.lib`.
- `styles.css` — shared styling for all three pages (screen + `@media print`).

Every page loads `lib.js` before its own page script. A top-level `<nav class="page-nav">` links the three pages.

## Architecture

`window.lib` (defined in `lib.js`) is the single source of truth for slab data and fee math:
- `courtSlabs`, `advocateSlabs` — declarative slab metadata (used for `describeSlab` rendering).
- `calculateCourtFee(v)` / `calculateAdvocateFee(v)` — imperative `if/else` ladders. The numbers are duplicated between the declarative tables and these ladders intentionally for clarity/performance; **any slab change must be made in both places in `lib.js`**, or displayed breakdown will disagree with the computed fee.
- `calculateAdvocateFee` enforces a `₹500` floor and returns `{ fee, slabIndex, minimumApplied }`. Pages append "Minimum applied" to the breakdown when `minimumApplied` is true.
- Helpers: `describeSlab`, `formatINR`, `formatINRDecimal`, `formatPct`, `escapeHtml`, `hl`, `attachIntFormatter(el, onInput)`, `attachDecimalConstraint(el, onInput)`, `attachExpressionFormatter(el, onInput)`, `evaluateExpression(str)`, `copyAmount`, `bindCopy`.

### Amount fields accept inline math

All amount inputs (principal, per-account misc, advocate misc, the single-amount inputs on the standalone pages) use `attachExpressionFormatter` instead of the integer-only formatter. The user can type expressions like `1800+200+800`, `(100+50)*2`, or `5000/2` directly into the field. `evaluateExpression` is a tiny hand-written parser supporting `+ - * /` and parens — **never use `eval` or the `Function` constructor.** The formatter applies Indian-numbering live only when the value is purely digits/commas; once an operator is typed, formatting steps aside until blur. On blur, the expression is evaluated and the field is replaced with the formatted integer result (decimals are rounded — amounts are integer throughout the app). Calculation-time readers also call `evaluateExpression` defensively in case blur didn't fire.

`attachIntFormatter` / `attachDecimalConstraint` take an optional `onInput` callback — pages pass their own `clearErrorState` so the formatter remains page-agnostic. Preserve the caret-preservation behaviour when touching this.

Each page's own script is a small IIFE that pulls what it needs from `window.lib`, wires its DOM, and implements the page's specific calculation flow.

## OS Case calculator (`index.html` + `app.js`)

### Form structure

The form is organised into three sections:

1. **Client Details** — `#clientName`, `#bankName`. One client per calculation. These appear only on the print sheet.
2. **Accounts** — `#accountsContainer` holds one or more `.account-card`s. Each card has its own A/c No., Principal, Interest Rate (% p.a.), Initial Date, Filing Date, **and per-account Misc Fees (`.acc-misc`)**. **+ Add Account** appends a new card; the `×` button on each card removes it (disabled when only one card remains). Cards are renumbered (`Account #N`) by `renumberAccountCards()` on every add/remove.
3. **Advocate Misc Fees** — `#advocateMisc`. Integer rupees. A single global field for typist/clerical pass-through costs that the advocate collects from the client. Distinct from per-account misc.

There is no modal anywhere in the app.

### Input → calculation flow

For each account:

1. **Days** = `filing − initial` (UTC midnight diff, in `daysBetween`). Per spec the count *includes* the initial date and *excludes* the filing date, which is exactly the plain difference — no `+1`/`−1` adjustment. Dates use plain `<input type="date">` so each browser supplies its own native picker (a custom `showPicker()` trigger broke on Safari historically — do not reintroduce). Values arrive as `YYYY-MM-DD`, ready for `daysBetween` without parsing.
2. **Interest** = `P × (days ÷ 365) × R` (R as decimal). Code computes daily SI as `P × R ÷ 365` then multiplies by days — algebraically identical. There is intentionally **no tenure input**: tenure in years would be `days ÷ 365`, so adding a separate `T` factor double-counts. Earlier versions had that bug; do not reintroduce it.
3. **Net Amount** (per account) = principal + interest **+ per-account misc fees**. Per-account misc represents notice fees etc. that legitimately raise that account's suit valuation.

Then aggregate:

4. **Net Suit Value** = Σ(account net amounts). This single figure feeds both fee slabs.
5. **Court Fee** = `calculateCourtFee(Net Suit Value)`.
6. **Advocate Fee — Initial Payment (½) + Advocate Misc** = `round(calculateAdvocateFee(Net Suit Value) / 2) + advocateMisc`.

**Two distinct misc concepts** — do not collapse:
- **Per-account misc** (notice fees etc.) rolls into that account's Net Amount and thus into Net Suit Value. It affects both fee slabs.
- **Advocate misc** (typist, clerical, pass-through costs) is added **only** to the final advocate initial payment. It never touches Net Suit Value or the court fee.

The advocate slab text in the UI shows the breakdown `Full ₹X, half = ₹Y + Advocate Misc ₹Z = ₹final` for transparency.

### Results display

The results section renders, in order:

1. **Per-Account Breakdown** — one `.account-result` per account: title (`Account #N` plus `A/c <number>` if provided), formula summary line (`Net = Principal + Interest + Misc`), and a grid (Days · Daily Interest · Total Interest · Misc Fees · Net Amount). `renderAccountResult(a)` builds the HTML.
2. **Net Suit Value** — single grand-total row: sum of account net amounts (which already include per-account misc).
3. **Court Fee** — slab description + rounded fee + copy button.
4. **Advocate Fee — Initial Payment (½) + Misc** — slab description (with the breakdown described above) + final amount + copy button.

Copy buttons copy the plain integer (no `₹`, no formatting) via `navigator.clipboard.writeText` with a `textarea`/`execCommand` fallback.

### Print feature

The **Print** button in the results section calls `window.print()` directly — no modal step. The `.print-header` div is hidden on-screen (`display: none`) and revealed only in the `@media print` block.

`doCalculate()` populates the print sheet at calculation time, so it is always in sync with the visible results. The sheet renders:

- Client header (Name, Bank Name)
- One `.sheet-account-block` per account (via `renderPrintAccount`) — each with Amount, Interest Rate, Initial/Filing dates + day count, daily-interest formula with symbolic substitution (fraction notation), total-interest formula with substitution, and the account's Net Amount (`Principal + Interest + Misc`).
- Aggregate total: Net Suit Value (sum of account nets, which already include per-account misc).
- Court fee: slab description + amount.
- Advocate fee: slab description + final amount (half + misc).

`.sheet-account-block` has `page-break-inside: avoid` so a single account is never split across pages.

### Keyboard contract

`Enter` calculates, `Esc` clears. The global `keydown` handler explicitly excludes the copy buttons, the print button, the **+ Add Account** button, and the per-card `.account-remove` buttons so `Enter` on them performs their own action (copy / print / add / remove) instead of recalculating.

## Standalone calculators (`court-fee.html`, `advocate-fee.html`)

Both pages reuse the same `lib.js` math and `styles.css` chrome as the OS Case page, so they share the slab tables and rounding behaviour. They differ only in their inputs:

- **Court Fee** — one `#amount` input. Computes `calculateCourtFee(amount)`; renders slab description + `Computed on ₹X`.
- **Advocate Fee** — `#amount` + `#advocateMisc`. Computes `round(calculateAdvocateFee(amount) / 2) + advocateMisc`; renders slab + `Full ₹X, half = ₹Y + Advocate Misc ₹Z = ₹final` (the misc clause is omitted when zero). The `Minimum ₹500 applied` note is shown when the slab raw is below the floor.

Neither page has a print sheet (only the OS Case page does). `Enter` calculates and `Esc` clears, same as OS Case.
