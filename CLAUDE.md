# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Single-file static web app: `index.html`. No build system, no package manager, no tests, no dependencies. To run, open `index.html` in a browser (or serve the directory with any static server, e.g. `python -m http.server`).

## Architecture

The entire app — markup, styles, and logic — lives in `index.html`. It is a calculator for Karnataka court fees and advocate fees under the Karnataka Court Fees & Suits Valuation Act, 1958 (Rule 100, Karnataka Civil Rules).

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

### Slab tables vs. calculators

Two parallel concerns drive the fee math:

1. **Slab tables** (`courtSlabs`, `advocateSlabs` near the top of the `<script>`) — declarative metadata used only for rendering the slab description shown under each result.
2. **Calculation functions** (`calculateCourtFee`, `calculateAdvocateFee`) — hardcoded `if/else` ladders that compute the actual fee. These duplicate the numbers from the slab tables intentionally for clarity/performance.

**Important:** because slab data is duplicated between the declarative tables and the imperative calculators, any change to a slab (floor, base, or rate) must be made in **both** places, or the displayed breakdown will disagree with the computed fee. The advocate fee additionally enforces a `₹500` minimum after the slab calculation; `doCalculate` appends a "Minimum applied" note to the slab description when that floor kicks in.

### Input formatters

`attachIntFormatter(el)` is the Indian-numbering, caret-preserving integer formatter (uses `countDigits` / `caretAfterNthDigit`). It is attached to **every** principal and misc-fees input on each account card (added when the card is created) and to the global advocate-misc field. Preserve this caret-preservation behaviour when touching input handling.

`attachDecimalConstraint(el)` handles rate fields (digits + single `.`).

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
