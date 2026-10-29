import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { assertBalanced, type LedgerLine } from "../../domain/ledger.js";
import { applyBps } from "../../domain/pricing.js";
import type { Tx } from "../../db/tx.js";
import { branches, ledgerAccounts, ledgerEntries, orders, quotes, restaurants } from "../../db/schema/index.js";

type AccountType = "ASSET" | "LIABILITY" | "REVENUE";
type OwnerType = "PLATFORM" | "MERCHANT" | "COURIER";

// Double-entry postings for a delivered order. Runs inside the DELIVERED transaction.
@Injectable()
export class LedgerService {
  async postDelivery(tx: Tx, orderId: string, courierId: string): Promise<void> {
    const [row] = await tx
      .select({
        totalFils: quotes.totalFils,
        subtotalFils: quotes.subtotalFils,
        deliveryFeeFils: quotes.deliveryFeeFils,
        serviceFeeFils: quotes.serviceFeeFils,
        vatFils: quotes.vatFils,
        tipFils: quotes.tipFils,
        orgId: restaurants.orgId,
        commissionRate: restaurants.commissionRate,
      })
      .from(orders)
      .innerJoin(quotes, eq(quotes.id, orders.quoteId))
      .innerJoin(branches, eq(branches.id, orders.branchId))
      .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!row) throw new Error("ledger: order not found");

    const commissionBps = Math.round(Number(row.commissionRate) * 10_000);
    const commissionFils = applyBps(row.subtotalFils, commissionBps);
    const merchantNetFils = row.subtotalFils - commissionFils;
    const courierFils = row.deliveryFeeFils + row.tipFils;

    const postings: { label: string; type: AccountType; owner: OwnerType; ownerId: string | null; debit: number; credit: number }[] = [
      { label: "Customer payment", type: "ASSET", owner: "PLATFORM", ownerId: null, debit: row.totalFils, credit: 0 },
      { label: "Merchant payable", type: "LIABILITY", owner: "MERCHANT", ownerId: row.orgId, debit: 0, credit: merchantNetFils },
      { label: "Commission revenue", type: "REVENUE", owner: "PLATFORM", ownerId: null, debit: 0, credit: commissionFils },
      { label: "Service fee revenue", type: "REVENUE", owner: "PLATFORM", ownerId: null, debit: 0, credit: row.serviceFeeFils },
      { label: "Courier payable", type: "LIABILITY", owner: "COURIER", ownerId: courierId, debit: 0, credit: courierFils },
      { label: "VAT payable", type: "LIABILITY", owner: "PLATFORM", ownerId: null, debit: 0, credit: row.vatFils },
    ];
    const lines: LedgerLine[] = postings.map((p) => ({ debitFils: p.debit, creditFils: p.credit }));
    assertBalanced(lines);

    const values = [];
    for (const p of postings) {
      if (p.debit === 0 && p.credit === 0) continue;
      const accountId = await this.account(tx, p.type, p.owner, p.ownerId);
      values.push({
        accountId,
        referenceType: "ORDER",
        referenceId: orderId,
        debitFils: p.debit,
        creditFils: p.credit,
        description: p.label,
      });
    }
    await tx.insert(ledgerEntries).values(values);
  }

  private async account(tx: Tx, type: AccountType, owner: OwnerType, ownerId: string | null): Promise<string> {
    const [found] = await tx
      .select({ id: ledgerAccounts.id })
      .from(ledgerAccounts)
      .where(
        and(
          eq(ledgerAccounts.type, type),
          eq(ledgerAccounts.ownerType, owner),
          ownerId ? eq(ledgerAccounts.ownerId, ownerId) : isNull(ledgerAccounts.ownerId),
        ),
      )
      .limit(1);
    if (found) return found.id;
    const [created] = await tx
      .insert(ledgerAccounts)
      .values({ type, ownerType: owner, ownerId })
      .returning({ id: ledgerAccounts.id });
    if (!created) throw new Error("ledger account insert returned no row");
    return created.id;
  }
}
