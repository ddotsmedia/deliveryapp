export type LedgerLine = { debitFils: number; creditFils: number };

// Double-entry guard: every posting set must balance and each line must be one-sided.
export function assertBalanced(lines: readonly LedgerLine[]): void {
  if (lines.length < 2) throw new Error("LEDGER_UNBALANCED: at least two lines required");
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.debitFils) || !Number.isInteger(l.creditFils)) throw new Error("LEDGER_UNBALANCED: non-integer amount");
    if (l.debitFils < 0 || l.creditFils < 0) throw new Error("LEDGER_UNBALANCED: negative amount");
    if (l.debitFils > 0 && l.creditFils > 0) throw new Error("LEDGER_UNBALANCED: two-sided line");
    debit += l.debitFils;
    credit += l.creditFils;
  }
  if (debit !== credit) throw new Error(`LEDGER_UNBALANCED: debit ${debit} != credit ${credit}`);
}
