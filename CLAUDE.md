# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Single-file static web app: `index.html`. No build system, no package manager, no tests, no dependencies. To run, open `index.html` in a browser (or serve the directory with any static server, e.g. `python -m http.server`).

## Architecture

The entire app — markup, styles, and logic — lives in `index.html`. It is a calculator for Karnataka court fees and advocate fees under the Karnataka Court Fees & Suits Valuation Act, 1958 (Rule 100, Karnataka Civil Rules).

### Input → calculation flow

The user enters principal, interest rate (% p.a.), initial date, and filing date. The advocate's workflow:

1. **Days** = `filing − initial` (UTC midnight diff, in `daysBetween`). Per spec the count *includes* the initial date and *excludes* the filing date, which is exactly the plain difference — no `+1`/`−1` adjustment. Dates use plain `<input type="date">` so each browser supplies its own native picker (important: a custom `showPicker()` trigger broke on Safari) and its own locale-appropriate typed-entry format. Values arrive as `YYYY-MM-DD`, ready for `daysBetween` without parsing.
2. **Interest** = `P × (days ÷ 365) × R` (R as decimal). Code computes daily SI as `P × R ÷ 365` then multiplies by days — algebraically identical. There is intentionally **no tenure input**: tenure in years would be `days ÷ 365`, so adding a separate `T` factor double-counts. Earlier versions of this file had that bug; do not reintroduce it.
3. **Net (suit) amount** = principal + interest. All fee slabs are applied to this net amount, not the principal.
4. **Advocate fee displayed = full advocate fee ÷ 2** (initial payment; remainder is collected after case completion). The full value is shown in the slab description for transparency.

### Results display

The results section shows three cards:

1. **Interest & Net Amount** — a 4-item breakdown grid: Days, Daily Interest (₹ decimal), Total Interest (₹ decimal), Net (Suit Value) (₹ rounded). The `interestSlab` line above the grid summarises the formula in text.
2. **Court Fee** — slab description + rounded fee amount with a copy button.
3. **Advocate Fee — Initial Payment (½)** — slab description + half fee with a copy button.

Copy buttons copy the plain integer (no `₹` symbol, no formatting) to the clipboard. The `navigator.clipboard` API is used with a `textarea`-based `execCommand` fallback.

### Slab tables vs. calculators

Two parallel concerns drive the fee math:

1. **Slab tables** (`courtSlabs`, `advocateSlabs` near the top of the `<script>`) — declarative metadata used only for rendering the slab description shown under each result (range label, base, marginal rate). They are the source of truth for the *displayed* breakdown.
2. **Calculation functions** (`calculateCourtFee`, `calculateAdvocateFee`) — hardcoded `if/else` ladders that compute the actual fee. These duplicate the numbers from the slab tables intentionally for clarity/performance.

**Important:** because slab data is duplicated between the declarative tables and the imperative calculators, any change to a slab (floor, base, or rate) must be made in **both** places, or the displayed breakdown will disagree with the computed fee. The advocate fee additionally enforces a `₹500` minimum after the slab calculation; `doCalculate` appends a "Minimum applied" note to the slab description when that floor kicks in.

The Indian-numbering input formatter (`input` event handler with `countDigits` / `caretAfterNthDigit`) preserves caret position while reformatting `1,23,456`-style grouping on every keystroke — preserve this behavior when touching the input handling.

### Print feature

After a calculation, a **Print** button appears in the results section. Clicking it opens a modal (`#modalOverlay`) that collects optional client details: Name, Bank Name, and A/c No.

Confirming the modal (`#modalPrint` or `Enter` in any modal field) calls `doPrint()`, which:
1. Writes the client details into the `.print-header` section.
2. Calls `window.print()`.

The `.print-header` div is hidden on-screen (`display: none`) and revealed only in the `@media print` block. It renders a structured **Calculation Sheet** with:
- Client details (Name, Bank, A/c No.)
- Principal, rate, dates
- Day count
- Daily interest formula with full symbolic substitution
- Total interest formula with substitution
- Net suit value
- Court fee: slab description + amount
- Advocate fee: slab description + half amount

Closing the modal (`#modalCancel`, `Esc`, or clicking the overlay backdrop) does not print.

### Keyboard contract

`Enter` calculates, `Esc` clears. The global `keydown` handler explicitly excludes the copy buttons and the print button so `Enter` on them copies / opens-the-print-modal instead of recalculating.

Inside the print modal: `Enter` triggers `doPrint()`, `Esc` closes the modal. The global `Escape` handler also closes the modal when it is open instead of clearing the main form.
