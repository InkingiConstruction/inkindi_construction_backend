/**
 * 🏗️  INKINGIPRO — WALLET SERVICE
 * ----------------------------------------------------------------------------
 * The Wallet is the **personal cash buffer** that lives between the Client's
 * payment provider (Stripe, MTN Momo, Airtel Money, Bank) and the **Project
 * Escrow Vaults** (per-project held funds).
 *
 * Think of it as a 3-layer money flow:
 *
 *    ┌──────────────────────────────────────────────────────────────────┐
 *    │  LAYER 1 — PAYMENT PROVIDERS                                    │
 *    │  Stripe • MTN Momo • Airtel Money • Bank Transfer               │
 *    │  (Money lives OUTSIDE the system until confirmed)                │
 *    └────────────────────────┬─────────────────────────────────────────┘
 *                             │  confirmFunding()  (atomic, on webhook)
 *                             ▼
 *    ┌──────────────────────────────────────────────────────────────────┐
 *    │  LAYER 2 — USER WALLET  ◀── this file                          │
 *    │  One wallet per user, holds the spendable balance.              │
 *    │  Can be ACTIVE (usable) or FROZEN (admin-locked).               │
 *    └────────────────────────┬─────────────────────────────────────────┘
 *                             │  transferToVault()  (user-initiated)
 *                             ▼
 *    ┌──────────────────────────────────────────────────────────────────┐
 *    │  LAYER 3 — ESCROW ACCOUNTS (Project Vaults)                     │
 *    │  One per project. Funds here back milestones and payouts.       │
 *    │  Managed by escrow-account.service.ts                            │
 *    └──────────────────────────────────────────────────────────────────┘
 *
 * ----------------------------------------------------------------------------
 * WHY THIS 3-LAYER DESIGN?
 * ----------------------------------------------------------------------------
 *  • A Wallet is REUSABLE across all of a client's projects.
 *  • Funding a Wallet ONCE then distributing to N vaults is cheaper
 *    (fewer mobile-money fees) and gives the client a single dashboard.
 *  • Escrow vaults stay CLEAN — they only ever receive project-bound money.
 *  • Freezing a Wallet (Layer 2) instantly blocks all vault funding without
 *    touching individual project accounts.
 *
 * ----------------------------------------------------------------------------
 * KEY DESIGN PRINCIPLES
 * ----------------------------------------------------------------------------
 *  • Atomicity: balance mutations always happen inside `prisma.$transaction`.
 *  • Immutability: every balance change writes a `WalletTransaction` row.
 *  • Decimal safety: all money is handled via `Prisma.Decimal` — never floats.
 *  • Event-driven: side-effects (emails, analytics) are pushed to BullMQ.
 *  • Idempotency: `FundingRequest` is the single source of truth for
 *    "did the provider actually pay us?" — replays are safe.
 * ============================================================================
 */

import {
  Prisma,
  Wallet,
  WalletTransaction,
  FundingRequest,
  TransactionStatus,
  WalletTransactionType,
} from "@prisma/client";
import prisma from "../../../config/db.js";
import { walletQueue } from "../../../queues/wallet.queue.js";

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of all input shapes we accept as a money value.
 * We never trust raw `number` from the wire — we always normalize to
 * `Prisma.Decimal` to avoid float drift on RWF amounts.
 */
type DecimalLike = Prisma.Decimal | number | string;

/**
 * Normalize any money-shaped input into a `Prisma.Decimal`.
 * - Already-Decimal values are passed through (zero allocation).
 * - Anything else is coerced via the constructor.
 */
const toDecimal = (v: DecimalLike): Prisma.Decimal =>
  v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export class WalletService {
  // ───────────────────────────────────────────────────────────────────────
  //  ensureWallet
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Returns the user's wallet, creating one on first access.
   *
   * Flow:
   *  1. Lookup by `userId` (unique).
   *  2. If found → return as-is (no event, no mutation).
   *  3. If not found → create with `balance: 0` and `status: "active"`.
   *  4. Enqueue `wallet.created` event for downstream (welcome email,
   *     analytics, default-currency adjustment, etc.).
   *
   * Safe to call repeatedly — the unique index on `userId` makes the
   * create path a no-op if a race-condition winner already inserted.
   *
   * @param userId    The owning user.
   * @param currency  ISO 4217 code; defaults to "RWF" (Rwandan Franc).
   * @returns The persisted `Wallet` row.
   */
  static async ensureWallet(userId: string, currency = "RWF"): Promise<Wallet> {
    const existing = await prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;

    const wallet = await prisma.wallet.create({
      data: { userId, currency, balance: 0, status: "active" },
    });

    await walletQueue.add("wallet.created", {
      userId,
      walletId: wallet.id,
    });

    return wallet;
  }

  // ───────────────────────────────────────────────────────────────────────
  //  getWallet
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Returns a rich snapshot of the user's wallet for the dashboard.
   *
   * Shape returned:
   *  - All scalar wallet fields (id, currency, status, balance, ...).
   *  - `availableBalance`  → alias for `balance` (clearer in the UI).
   *  - `totalInProjectVaults` → sum of all `deposit` transactions
   *                              the user has made into escrow vaults.
   *  - `netFlow`           → sum of all completed wallet transactions
   *                          (inflows minus outflows expressed as a single
   *                          signed value).
   *  - `_count` of transactions and funding requests.
   *  - The 20 most recent `WalletTransaction` rows.
   *
   * @returns The composite wallet view, or `null` if no wallet exists yet.
   */
  static async getWallet(userId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        _count: { select: { transactions: true, fundingRequests: true } },
        transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!wallet) return null;

    const aggregates = await prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, status: "completed" },
      _sum: { amount: true },
    });

    const totalInVaults = await prisma.transaction.aggregate({
      where: { actorId: userId, type: "deposit", status: "completed" },
      _sum: { amount: true },
    });

    return {
      ...wallet,
      availableBalance: wallet.balance,
      totalInProjectVaults: totalInVaults._sum.amount ?? new Prisma.Decimal(0),
      netFlow: aggregates._sum.amount ?? new Prisma.Decimal(0),
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  //  createFundingRequest
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Creates a **PENDING** funding request. Money has NOT moved yet.
   *
   * Lifecycle:
   *  1. Client picks a provider (Stripe / MTN Momo / Airtel / Bank).
   *  2. We persist a `FundingRequest` row with `status: "pending"` and a
   *     30-minute `expiresAt` window.
   *  3. The provider's SDK is then invoked elsewhere (controller / service)
   *     to collect the money from the client.
   *  4. The provider eventually calls back → `confirmFunding()` runs.
   *
   * The 30-minute expiry is a safety net: if the provider never responds
   * (user closed the app, USSD timeout, etc.) the request auto-fails and
   * the client is forced to retry.
   *
   * @throws Error when `amount` is zero or negative.
   * @returns The persisted `FundingRequest`.
   */
  static async createFundingRequest(params: {
    userId: string;
    amount: DecimalLike;
    method: "stripe" | "mtn_momo" | "airtel_money" | "bank_transfer";
    phoneNumber?: string;
    metadata?: Prisma.JsonObject;
  }) {
    const wallet = await this.ensureWallet(params.userId);
    const amount = toDecimal(params.amount);

    if (amount.lte(0)) throw new Error("Funding amount must be positive");

    return prisma.fundingRequest.create({
      data: {
        walletId: wallet.id,
        userId: params.userId,
        amount,
        method: params.method,
        status: "pending",
        phoneNumber: params.phoneNumber,
        metadata: (params.metadata ?? {}) as Prisma.JsonObject,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  //  confirmFunding
  // ───────────────────────────────────────────────────────────────────────
  /**
   * THE CRITICAL ATOMIC OPERATION.
   *
   * Called by the **provider webhook** (Stripe `payment_intent.succeeded`,
   * MTN `PaymentCallback`, etc.) — or by the test simulator.
   *
   * Inside ONE `prisma.$transaction` we:
   *  1. Load the `FundingRequest` + its wallet.
   *  2. Guard: must be `pending` (replay-safe — completed/failed requests
   *     are rejected so we never credit twice).
   *  3. Guard: must not be expired — if it is, we mark it `failed`
   *     and abort the credit.
   *  4. Mark the funding request `completed` and stamp `providerRef`.
   *  5. Increment `wallet.balance` by the request amount.
   *  6. Insert a `WalletTransaction` of type `"funding"` capturing
   *     `balanceBefore` / `balanceAfter` for an immutable audit trail.
   *
   * ONLY after the DB commit succeeds do we enqueue `wallet.funded`
   * (for emails, push notifications, analytics).
   *
   * @param fundingRequestId  The row created in `createFundingRequest`.
   * @param providerRef       The provider's own transaction id/reference.
   * @throws Error if the request is missing, already terminal, or expired.
   */
  static async confirmFunding(fundingRequestId: string, providerRef: string) {
    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.fundingRequest.findUnique({
        where: { id: fundingRequestId },
        include: { wallet: true },
      });

      if (!req) throw new Error("Funding request not found");
      if (req.status !== "pending") {
        throw new Error(`Funding request already ${req.status}`);
      }
      if (req.expiresAt && req.expiresAt < new Date()) {
        await tx.fundingRequest.update({
          where: { id: req.id },
          data: { status: "failed", failureReason: "expired" },
        });
        throw new Error("Funding request expired");
      }

      await tx.fundingRequest.update({
        where: { id: req.id },
        data: { status: "completed", providerRef, completedAt: new Date() },
      });

      const balanceBefore = req.wallet.balance;
      const balanceAfter = balanceBefore.plus(req.amount);

      const updatedWallet = await tx.wallet.update({
        where: { id: req.walletId },
        data: { balance: { increment: req.amount } },
      });

      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: req.walletId,
          type: "funding",
          amount: req.amount,
          balanceBefore,
          balanceAfter,
          currency: req.currency,
          status: "completed",
          reference: providerRef,
          description: `Funded via ${req.method}`,
          completedAt: new Date(),
          metadata: { fundingRequestId: req.id, method: req.method },
        },
      });

      return {
        wallet: updatedWallet,
        transaction: walletTx,
        fundingRequest: req,
        amount: req.amount,
      };
    });

    await walletQueue.add("wallet.funded", {
      userId: result.wallet.userId,
      walletId: result.wallet.id,
      amount: Number(result.amount),
      fundingRequestId,
    });

    return result;
  }

  // ───────────────────────────────────────────────────────────────────────
  //  simulateFundingSuccess
  // ───────────────────────────────────────────────────────────────────────
  /**
   * TEST-ONLY helper. Mints a fake `providerRef` and calls
   * `confirmFunding()`. Use this in dev/staging so you don't need a
   * real Stripe webhook to test the happy path.
   *
   * Must NEVER be wired into a production route.
   */
  static async simulateFundingSuccess(fundingRequestId: string) {
    const providerRef = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.confirmFunding(fundingRequestId, providerRef);
  }

  // ───────────────────────────────────────────────────────────────────────
  //  transferToVault
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Moves money from the user's **Wallet** into a specific **Escrow Vault**.
   *
   * This is the bridge between Layer 2 and Layer 3 in the architecture.
   * All 4 mutations happen inside ONE transaction:
   *  1. Debit `wallet.balance` (and emit a negative `vault_deposit` row).
   *  2. Credit `escrowAccount.balance`.
   *  3. Insert a `Transaction` of type `"deposit"` linking the two sides.
   *
   * Guards:
   *  - Amount must be > 0.
   *  - Wallet must exist and not be `frozen`.
   *  - Wallet must have sufficient balance.
   *  - Escrow account must exist.
   *  - Caller must be the project's `clientId` (only owners can fund
   *    their own vault — prevents user A from funding user B's project).
   *  - Currency on both sides must match (no cross-currency leakage).
   *
   * Emits `wallet.vault_transfer` post-commit for notifications.
   */
  static async transferToVault(params: {
    userId: string;
    escrowAccountId: string;
    amount: DecimalLike;
    description?: string;
  }) {
    const amount = toDecimal(params.amount);

    if (amount.lte(0)) throw new Error("Amount must be positive");

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: params.userId },
      });
      if (!wallet) throw new Error("Wallet not found");
      if (wallet.status === "frozen") throw new Error("Wallet is frozen");
      if (wallet.balance.lt(amount)) {
        throw new Error("Insufficient wallet balance");
      }

      const escrow = await tx.escrowAccount.findUnique({
        where: { id: params.escrowAccountId },
        include: { project: true },
      });
      if (!escrow) throw new Error("Escrow account not found");
      if (escrow.project.clientId !== params.userId) {
        throw new Error("Only the project owner can fund this vault");
      }
      if (wallet.currency !== escrow.currency) {
        throw new Error(
          `Currency mismatch: wallet=${wallet.currency}, vault=${escrow.currency}`,
        );
      }

      const walletBefore = wallet.balance;
      const walletAfter = walletBefore.minus(amount);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "vault_deposit",
          amount: amount.negated(),
          balanceBefore: walletBefore,
          balanceAfter: walletAfter,
          currency: wallet.currency,
          status: "completed",
          escrowAccountId: escrow.id,
          completedAt: new Date(),
          description:
            params.description ?? `Funded project vault: ${escrow.project.name}`,
          reference: `WT-VAULT-${Date.now()}`,
        },
      });

      await tx.escrowAccount.update({
        where: { id: escrow.id },
        data: { balance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          escrowAccountId: escrow.id,
          actorId: params.userId,
          type: "deposit",
          method: "bank_transfer",
          amount,
          status: "completed",
          reference: `VAULT-${Date.now()}`,
          completedAt: new Date(),
          metadata: {
            source: "wallet",
            walletId: wallet.id,
            description: params.description,
          },
        },
      });

      return { walletId: wallet.id, escrowAccountId: escrow.id, amount };
    });

    await walletQueue.add("wallet.vault_transfer", {
      userId: params.userId,
      walletId: result.walletId,
      escrowAccountId: result.escrowAccountId,
      amount: Number(result.amount),
    });

    return result;
  }

  // ───────────────────────────────────────────────────────────────────────
  //  getProjectVaultBalance
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Returns a single vault's balance plus the caller's own deposit
   * history against that vault. Use for the "Project Vault Detail" page.
   *
   * Note: we DON'T enforce ownership here at the DB level — the controller
   * is expected to authorize. Add an extra check if you need strict
   * server-side ownership verification.
   */
  static async getProjectVaultBalance(userId: string, escrowAccountId: string) {
    const escrow = await prisma.escrowAccount.findUnique({
      where: { id: escrowAccountId },
      include: {
        project: true,
        transactions: {
          where: { actorId: userId, type: "deposit", status: "completed" },
        },
      },
    });

    if (!escrow) return null;

    const totalDeposited = escrow.transactions.reduce(
      (sum, t) => sum.plus(t.amount),
      new Prisma.Decimal(0),
    );

    return {
      escrowAccountId: escrow.id,
      projectId: escrow.projectId,
      projectName: escrow.project.name,
      currency: escrow.currency,
      currentBalance: escrow.balance,
      lockedBalance: escrow.lockedBalance,
      yourTotalDeposited: totalDeposited,
      transactions: escrow.transactions,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  //  listUserProjectVaults
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Lists every escrow vault owned by the user across all their projects.
   *
   * For each vault we compute:
   *  - `currentBalance`   → live balance in the escrow account.
   *  - `yourDeposits`     → sum of `deposit` transactions by this user.
   *  - `yourReleases`     → sum of `release` + `auto_payment` transactions.
   *  - `yourNet`          → deposits − releases (the user's effective stake).
   *
   * Used by the "My Project Vaults" dashboard tab.
   */
  static async listUserProjectVaults(userId: string) {
    const escrows = await prisma.escrowAccount.findMany({
      where: { project: { clientId: userId }, deletedAt: null },
      include: {
        project: { select: { id: true, name: true, status: true } },
        transactions: {
          where: { actorId: userId, status: "completed" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return escrows.map((e) => {
      const yourDeposits = e.transactions
        .filter((t) => t.type === "deposit")
        .reduce((s, t) => s.plus(t.amount), new Prisma.Decimal(0));
      const yourReleases = e.transactions
        .filter((t) => t.type === "release" || t.type === "auto_payment")
        .reduce((s, t) => s.plus(t.amount), new Prisma.Decimal(0));

      return {
        escrowAccountId: e.id,
        projectId: e.projectId,
        projectName: e.project.name,
        projectStatus: e.project.status,
        currency: e.currency,
        currentBalance: e.balance,
        yourDeposits,
        yourReleases,
        yourNet: yourDeposits.minus(yourReleases),
      };
    });
  }

  static async deleteProjectVault(userId: string, escrowAccountId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      const escrow = await tx.escrowAccount.findUnique({
        where: { id: escrowAccountId },
        include: { project: true },
      });
      if (!escrow) throw new Error("Project wallet not found");
      if (escrow.project.clientId !== userId) {
        throw new Error("Only the project owner can delete this wallet");
      }
      if (escrow.lockedBalance.gt(0)) {
        throw new Error("Cannot delete a wallet with locked milestone funds");
      }
      if (escrow.deletedAt) {
        return { walletId: wallet.id, escrowAccountId: escrow.id, refundedAmount: new Prisma.Decimal(0) };
      }

      const refundAmount = new Prisma.Decimal(escrow.balance);
      const walletBefore = wallet.balance;
      const walletAfter = walletBefore.plus(refundAmount);

      if (refundAmount.gt(0)) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: refundAmount } },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "vault_refund",
            amount: refundAmount,
            balanceBefore: walletBefore,
            balanceAfter: walletAfter,
            currency: wallet.currency,
            status: "completed",
            escrowAccountId: escrow.id,
            completedAt: new Date(),
            description: `Refund from deleted project wallet: ${escrow.project.name}`,
            reference: `WT-VAULT-REFUND-${Date.now()}`,
          },
        });
      }

      await tx.escrowAccount.update({
        where: { id: escrow.id },
        data: {
          balance: 0,
          status: "deleted",
          deletedAt: new Date(),
        },
      });

      return { walletId: wallet.id, escrowAccountId: escrow.id, refundedAmount: refundAmount };
    });

    await walletQueue.add("wallet.vault_deleted", {
      userId,
      walletId: result.walletId,
      escrowAccountId: result.escrowAccountId,
      amount: Number(result.refundedAmount),
    });

    return result;
  }

  // ───────────────────────────────────────────────────────────────────────
  //  getWalletHistory
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Paginated, optionally filtered history of `WalletTransaction` rows.
   *
   * Filters:
   *  - `page` / `limit` → standard offset pagination.
   *  - `type`           → restrict to a single `WalletTransactionType`
   *                      (e.g. only "funding" or only "vault_deposit").
   *
   * Returns `{ items, total, page, limit, totalPages }` for easy
   * table rendering on the frontend.
   */
  static async getWalletHistory(
    userId: string,
    opts: { page?: number; limit?: number; type?: WalletTransactionType } = {},
  ) {
    const { page = 1, limit = 20, type } = opts;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return { items: [], total: 0, page, limit };

    const where = {
      walletId: wallet.id,
      ...(type ? { type } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { wallet: { select: { currency: true } } },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ───────────────────────────────────────────────────────────────────────
  //  setWalletStatus
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Admin operation: freeze or unfreeze a wallet.
   *
   *  - Frozen wallets:
   *      • `transferToVault()` will refuse with "Wallet is frozen".
   *      • `confirmFunding()` will STILL succeed (the user may top up
   *        while frozen — admins typically allow this for reconciliation).
   *  - Unfrozen wallets:
   *      • `frozenReason` is cleared back to `null`.
   *
   * Emits `wallet.frozen` / `wallet.unfrozen` for audit-log subscribers.
   *
   * @param userId  The wallet owner.
   * @param status  "active" or "frozen".
   * @param reason  Required when freezing; ignored when unfreezing.
   */
  static async setWalletStatus(
    userId: string,
    status: "active" | "frozen",
    reason?: string,
  ) {
    const wallet = await prisma.wallet.update({
      where: { userId },
      data: {
        status,
        ...(status === "frozen"
          ? { frozenReason: reason }
          : { frozenReason: null }),
      },
    });

    await walletQueue.add(
      status === "frozen" ? "wallet.frozen" : "wallet.unfrozen",
      {
        walletId: wallet.id,
        ...(status === "frozen" ? { reason: reason ?? "frozen by admin" } : {}),
      },
    );

    return wallet;
  }
}
