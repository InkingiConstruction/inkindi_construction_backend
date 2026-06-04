/**
 * ============================================================================
 * 📄 FILE: wallet.service.ts
 * PURPOSE: Manages user wallets — funding, balance, transfers, payouts
 * PRINCIPLE: SOLID (business logic), KISS, atomic transactions
 * ============================================================================
 */

import { Prisma, Wallet, WalletTransaction, FundingRequest, TransactionStatus, WalletTransactionType } from "@prisma/client";
import prisma from "../../../config/db.js";
import { walletQueue } from "../../../queues/wallet.queue.js";

type DecimalLike = Prisma.Decimal | number | string;

const toDecimal = (v: DecimalLike) =>
  v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);

export class WalletService {
  /**
   * Ensures a wallet exists for the user. Called on user registration.
   * Idempotent — safe to call multiple times.
   */
  static async ensureWallet(userId: string, currency = "RWF"): Promise<Wallet> {
    const existing = await prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;

    const wallet = await prisma.wallet.create({
      data: { userId, currency, balance: 0, status: "active" },
    });

    // Fire async event (does not block creation)
    await walletQueue.add("wallet.created", {
      type: "wallet.created",
      userId,
      walletId: wallet.id,
    });

    return wallet;
  }

  /**
   * Get wallet with computed stats
   */
  static async getWallet(userId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        _count: { select: { transactions: true, fundingRequests: true } },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!wallet) return null;

    // Aggregate totals
    const aggregates = await prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, status: "completed" },
      _sum: { amount: true },
    });

    const totalInVaults = await prisma.transaction.aggregate({
      where: {
        actorId: userId,
        type: "deposit",
        status: "completed",
      },
      _sum: { amount: true },
    });

    return {
      ...wallet,
      availableBalance: wallet.balance,
      totalInProjectVaults: totalInVaults._sum.amount ?? new Prisma.Decimal(0),
      netFlow: aggregates._sum.amount ?? new Prisma.Decimal(0),
    };
  }

  /**
   * Create a funding request (simulating Stripe / Momo intent).
   * The actual balance is credited only after `confirmFunding()` succeeds.
   */
  static async createFundingRequest(params: {
    userId: string;
    amount: DecimalLike;
    method: "stripe" | "mtn_momo" | "airtel_money" | "bank_transfer";
    phoneNumber?: string;
    metadata?: Record<string, unknown>;
  }) {
    const wallet = await this.ensureWallet(params.userId);
    const amount = toDecimal(params.amount);

    if (amount.lte(0)) {
      throw new Error("Funding amount must be positive");
    }

    return prisma.fundingRequest.create({
      data: {
        walletId: wallet.id,
        userId: params.userId,
        amount,
        method: params.method,
        status: "pending",
        phoneNumber: params.phoneNumber,
        metadata: params.metadata ?? {},
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min expiry
      },
    });
  }

  /**
   * Confirm and complete a funding request — credits the wallet.
   * ATOMIC: balance + transaction created in a single Prisma transaction.
   */
  static async confirmFunding(fundingRequestId: string, providerRef: string) {
    return prisma.$transaction(async (tx) => {
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

      // Mark funding as completed
      await tx.fundingRequest.update({
        where: { id: req.id },
        data: {
          status: "completed",
          providerRef,
          completedAt: new Date(),
        },
      });

      // Update wallet balance
      const balanceBefore = req.wallet.balance;
      const balanceAfter = balanceBefore.plus(req.amount);

      const updatedWallet = await tx.wallet.update({
        where: { id: req.walletId },
        data: { balance: { increment: req.amount } },
      });

      // Create wallet transaction record
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

      return { wallet: updatedWallet, transaction: walletTx, fundingRequest: req };
    }).then(async (result) => {
      // Fire async event AFTER transaction commits
      await walletQueue.add("wallet.funded", {
        type: "wallet.funded",
        userId: result.wallet.userId,
        walletId: result.wallet.id,
        amount: Number(req.amount),
        fundingRequestId,
      });
      return result;
    });
  }

  /**
   * Simulate provider confirmation (for testing without real Stripe/Momo).
   * In production, this would be replaced by a webhook handler.
   */
  static async simulateFundingSuccess(fundingRequestId: string) {
    const providerRef = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.confirmFunding(fundingRequestId, providerRef);
  }

  /**
   * Transfer money from user wallet to a project vault.
   * ATOMIC with row-level safety.
   */
  static async transferToVault(params: {
    userId: string;
    escrowAccountId: string;
    amount: DecimalLike;
    description?: string;
  }) {
    const amount = toDecimal(params.amount);

    if (amount.lte(0)) throw new Error("Amount must be positive");

    return prisma.$transaction(async (tx) => {
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
        throw new Error(`Currency mismatch: wallet=${wallet.currency}, vault=${escrow.currency}`);
      }

      // Debit wallet
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
          description: params.description ?? `Funded project vault: ${escrow.project.name}`,
          reference: `WT-VAULT-${Date.now()}`,
        },
      });

      // Credit vault
      const vaultBefore = escrow.balance;
      const vaultAfter = vaultBefore.plus(amount);
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
    }).then(async (result) => {
      await walletQueue.add("wallet.vault_transfer", {
        type: "wallet.vault_transfer",
        userId: params.userId,
        walletId: result.walletId,
        escrowAccountId: result.escrowAccountId,
        amount: Number(result.amount),
      });
      return result;
    });
  }

  /**
   * Get total money the user has put into a specific project vault
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

  /**
   * List all vaults the user has funded, with running balance
   */
  static async listUserProjectVaults(userId: string) {
    const escrows = await prisma.escrowAccount.findMany({
      where: {
        project: {
          clientId: userId,
        },
      },
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

  /**
   * Get paginated wallet transaction history
   */
  static async getWalletHistory(userId: string, opts: {
    page?: number;
    limit?: number;
    type?: WalletTransactionType;
  } = {}) {
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
        include: {
          wallet: { select: { currency: true } },
        },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Admin: freeze/unfreeze a wallet
   */
  static async setWalletStatus(userId: string, status: "active" | "frozen", reason?: string) {
    const wallet = await prisma.wallet.update({
      where: { userId },
      data: {
        status,
        ...(status === "frozen" ? { frozenReason: reason } : { frozenReason: null }),
      },
    });

    await walletQueue.add("wallet.status", {
      type: status === "frozen" ? "wallet.frozen" : "wallet.unfrozen",
      walletId: wallet.id,
      ...(status === "frozen" ? { reason: reason ?? "frozen by admin" } : {}),
    });

    return wallet;
  }
}
