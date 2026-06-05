"use strict";
/**
 * ============================================================================
 * 📄 FILE: wallet.controller.ts
 * PURPOSE: HTTP handlers for the user wallet system
 *          (funding, balance, history, vault transfers)
 * PRINCIPLE: SOLID (HTTP layer separate from business logic in wallet.service.ts)
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectVaultDetails = exports.listMyProjectVaults = exports.transferToVault = exports.confirmFundingTest = exports.initiateFunding = exports.getMyWalletHistory = exports.getMyWallet = void 0;
const escrow_service_1 = require("./escrow.service");
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
/**
 * @swagger
 * /api/v1/escrow-accounts/wallet:
 *   get:
 *     summary: Get current user's wallet summary
 *     description: |
 *       Returns the authenticated user's wallet with:
 *       - Current available balance
 *       - Total money held across all project vaults
 *       - Net flow (sum of all completed transactions)
 *       - Last 20 wallet transactions
 *       - Counts of transactions and funding requests
 *
 *       **Process:**
 *       1. Server ensures a wallet exists for the user (idempotent).
 *       2. Loads the wallet with related stats.
 *       3. Aggregates total deposits across all the user's project vaults.
 *       4. Returns a JSON object.
 *
 *       **Use this endpoint as the main dashboard call for the wallet screen.**
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet summary returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: clw7x8h3z0001abc123def456
 *                 userId:
 *                   type: string
 *                 balance:
 *                   type: string
 *                   description: Available balance (Decimal as string)
 *                   example: "150000.00"
 *                 currency:
 *                   type: string
 *                   example: RWF
 *                 status:
 *                   type: string
 *                   enum: [active, frozen, closed]
 *                 availableBalance:
 *                   type: string
 *                   example: "150000.00"
 *                 totalInProjectVaults:
 *                   type: string
 *                   description: Sum of all money the user has put into project vaults
 *                   example: "70000.00"
 *                 netFlow:
 *                   type: string
 *                   description: Sum of all completed wallet transactions
 *                   example: "150000.00"
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WalletTransaction'
 *                 _count:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: integer
 *                     fundingRequests:
 *                       type: integer
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       500:
 *         description: Internal Server Error
 */
const getMyWallet = async (req, res) => {
    try {
        await escrow_service_1.WalletService.ensureWallet(req.user.id);
        const summary = await escrow_service_1.WalletService.getWallet(req.user.id);
        return res.json(summary);
    }
    catch (error) {
        console.error("Get wallet error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMyWallet = getMyWallet;
/**
 * @swagger
 * /api/v1/wallet/transactions:
 *   get:
 *     summary: Get paginated wallet transaction history
 *     description: |
 *       Returns a paginated list of all wallet transactions for the
 *       authenticated user, newest first. Optional `type` filter.
 *
 *       **Process:**
 *       1. Reads `page`, `limit`, and `type` from query string.
 *       2. Looks up the user's wallet.
 *       3. Returns transactions + pagination metadata.
 *
 *       **Query params:**
 *       - `page` (default 1)
 *       - `limit` (default 20, max 100)
 *       - `type` — one of: `funding`, `withdrawal`, `vault_deposit`,
 *         `vault_refund`, `milestone_payout`, `penalty`, `adjustment`, `refund`
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [funding, withdrawal, vault_deposit, vault_refund, milestone_payout, penalty, adjustment, refund]
 *     responses:
 *       200:
 *         description: Transaction history returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WalletTransaction'
 *                 total:
 *                   type: integer
 *                   example: 42
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 20
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
const getMyWalletHistory = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const type = req.query.type;
        const result = await escrow_service_1.WalletService.getWalletHistory(req.user.id, {
            page,
            limit,
            type,
        });
        return res.json(result);
    }
    catch (error) {
        console.error("Get wallet history error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMyWalletHistory = getMyWalletHistory;
/**
 * @swagger
 * /api/v1/wallet/fund:
 *   post:
 *     summary: Initiate a wallet funding request (simulated Stripe / MTN Momo)
 *     description: |
 *       Creates a `FundingRequest` in `pending` state. **No money is moved
 *       yet** — the wallet balance is only credited when the funding
 *       is confirmed (in production this happens via Stripe / Momo webhook;
 *       in this build you call `/wallet/fund/{id}/confirm` to simulate it).
 *
 *       **Process:**
 *       1. Validates `amount` (>0), `method` (one of the allowed values),
 *          and `phoneNumber` (required for mobile money).
 *       2. Ensures the user has a wallet (auto-creates one if missing).
 *       3. Creates a `FundingRequest` with status `pending` and a
 *          30-minute expiry.
 *       4. Returns the created funding request. Client should then call
 *          `/wallet/fund/{id}/confirm` (test mode) or wait for the
 *          real provider webhook.
 *
 *       **Required roles:** client
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, method]
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 100000
 *               method:
 *                 type: string
 *                 enum: [stripe, mtn_momo, airtel_money, bank_transfer]
 *                 example: stripe
 *               phoneNumber:
 *                 type: string
 *                 description: Required for `mtn_momo` and `airtel_money`
 *                 example: "+250788123456"
 *     responses:
 *       201:
 *         description: Funding request created (pending confirmation)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Funding request created. Confirm to complete.
 *                 fundingRequest:
 *                   $ref: '#/components/schemas/FundingRequest'
 *       400:
 *         description: Validation error (bad amount / method / missing phone)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
const initiateFunding = async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        const method = req.body.method;
        const phoneNumber = req.body.phoneNumber;
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: "Valid amount is required" });
        }
        if (!["stripe", "mtn_momo", "airtel_money", "bank_transfer"].includes(method)) {
            return res.status(400).json({ message: "Invalid payment method" });
        }
        if ((method === "mtn_momo" || method === "airtel_money") && !phoneNumber) {
            return res
                .status(400)
                .json({ message: "Phone number required for mobile money" });
        }
        const funding = await escrow_service_1.WalletService.createFundingRequest({
            userId: req.user.id,
            amount,
            method,
            phoneNumber,
            metadata: { initiatedBy: req.user.id, ip: req.ip },
        });
        return res.status(201).json({
            message: "Funding request created. Confirm to complete.",
            fundingRequest: funding,
        });
    }
    catch (error) {
        console.error("Initiate funding error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.initiateFunding = initiateFunding;
/**
 * @swagger
 * /api/v1/wallet/fund/{fundingId}/confirm:
 *   post:
 *     summary: Simulate a successful provider confirmation (TEST ONLY)
 *     description: |
 *       **⚠️ Test/simulation endpoint.** In production this is replaced by
 *       the Stripe / MTN Momo webhook handler that calls
 *       `WalletService.confirmFunding` internally.
 *
 *       **Process:**
 *       1. Looks up the funding request.
 *       2. Validates it is still `pending` and not expired.
 *       3. In a single Prisma transaction:
 *          - Marks the funding request as `completed`.
 *          - Increments the wallet balance.
 *          - Creates a `WalletTransaction` of type `funding`.
 *       4. Fires a `wallet.funded` event to BullMQ (for analytics /
 *          notifications / receipts).
 *
 *       **Required roles:** client, admin
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fundingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Funding completed (simulated)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Funding completed (simulated)
 *                 data:
 *                   type: object
 *                   properties:
 *                     wallet:
 *                       $ref: '#/components/schemas/Wallet'
 *                     transaction:
 *                       $ref: '#/components/schemas/WalletTransaction'
 *                     fundingRequest:
 *                       $ref: '#/components/schemas/FundingRequest'
 *       400:
 *         description: Bad request — funding not found, expired, or already processed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
const confirmFundingTest = async (req, res) => {
    try {
        const fundingId = getParamId(req.params.fundingId);
        if (!fundingId)
            return res.status(400).json({ message: "Funding ID required" });
        const result = await escrow_service_1.WalletService.simulateFundingSuccess(fundingId);
        return res.json({
            message: "Funding completed (simulated)",
            data: result,
        });
    }
    catch (error) {
        console.error("Confirm funding error:", error);
        return res
            .status(400)
            .json({ message: error.message ?? "Funding confirmation failed" });
    }
};
exports.confirmFundingTest = confirmFundingTest;
/**
 * @swagger
 * /api/v1/wallet/transfer-to-vault:
 *   post:
 *     summary: Transfer money from your wallet to a project vault
 *     description: |
 *       Moves `amount` from the authenticated user's wallet into a
 *       specific project's escrow account (vault).
 *
 *       **Preconditions:**
 *       - User must own the project (project.clientId === user.id).
 *       - Wallet must be `active` (not frozen).
 *       - Wallet balance must be >= amount.
 *       - Wallet currency must match vault currency.
 *
 *       **Process (atomic — all or nothing):**
 *       1. Debits the wallet (decrements `balance`).
 *       2. Creates a `WalletTransaction` of type `vault_deposit`
 *          (amount is stored as negative to indicate outflow).
 *       3. Credits the project vault (increments `EscrowAccount.balance`).
 *       4. Creates a `Transaction` of type `deposit` on the escrow.
 *       5. Fires a `wallet.vault_transfer` event to BullMQ.
 *
 *       **Required roles:** client
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [escrowAccountId, amount]
 *             properties:
 *               escrowAccountId:
 *                 type: string
 *                 example: clw7x8h3z0001abc123def456
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 70000
 *               description:
 *                 type: string
 *                 example: Phase 1 funding
 *     responses:
 *       200:
 *         description: Transfer to vault succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Transfer to vault successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     walletId:
 *                       type: string
 *                     escrowAccountId:
 *                       type: string
 *                     amount:
 *                       type: string
 *                       example: "70000"
 *       400:
 *         description: |
 *           Validation error — missing fields, insufficient balance,
 *           currency mismatch, frozen wallet, or not project owner
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
const transferToVault = async (req, res) => {
    try {
        const { escrowAccountId, amount, description } = req.body;
        if (!escrowAccountId || !Number.isFinite(Number(amount))) {
            return res
                .status(400)
                .json({ message: "escrowAccountId and amount required" });
        }
        const result = await escrow_service_1.WalletService.transferToVault({
            userId: req.user.id,
            escrowAccountId,
            amount: Number(amount),
            description,
        });
        return res.json({ message: "Transfer to vault successful", data: result });
    }
    catch (error) {
        console.error("Transfer to vault error:", error);
        return res
            .status(400)
            .json({ message: error.message ?? "Transfer failed" });
    }
};
exports.transferToVault = transferToVault;
/**
 * @swagger
 * /api/v1/wallet/project-vaults:
 *   get:
 *     summary: List all project vaults the user has funded
 *     description: |
 *       Returns a list of every project the user (as client) owns, with
 *       a computed summary of their deposits, releases, and the current
 *       vault balance.
 *
 *       **Process:**
 *       1. Finds all projects where `clientId === user.id`.
 *       2. For each project, aggregates:
 *          - `yourDeposits` (sum of completed deposit transactions)
 *          - `yourReleases` (sum of completed release/auto_payment transactions)
 *          - `yourNet` (deposits - releases)
 *          - `currentBalance` (live `EscrowAccount.balance`)
 *
 *       **Required roles:** any authenticated user
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of project vaults with summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       escrowAccountId:
 *                         type: string
 *                       projectId:
 *                         type: string
 *                       projectName:
 *                         type: string
 *                       projectStatus:
 *                         type: string
 *                         enum: [draft, active, paused, completed, terminated]
 *                       currency:
 *                         type: string
 *                       currentBalance:
 *                         type: string
 *                         example: "70000.00"
 *                       yourDeposits:
 *                         type: string
 *                       yourReleases:
 *                         type: string
 *                       yourNet:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
const listMyProjectVaults = async (req, res) => {
    try {
        const vaults = await escrow_service_1.WalletService.listUserProjectVaults(req.user.id);
        return res.json({ items: vaults });
    }
    catch (error) {
        console.error("List vaults error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.listMyProjectVaults = listMyProjectVaults;
/**
 * @swagger
 * /api/v1/wallet/project-vaults/{escrowAccountId}:
 *   get:
 *     summary: Get details for a specific project vault
 *     description: |
 *       Returns the vault's current balance, locked balance, the user's
 *       total deposited amount, and a list of all completed deposit
 *       transactions the user has made into this vault.
 *
 *       **Process:**
 *       1. Looks up the escrow account by ID.
 *       2. Filters transactions to the requesting user, type=deposit,
 *          status=completed.
 *       3. Computes the total deposited amount.
 *
 *       **Required roles:** any authenticated user
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: escrowAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vault details returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 escrowAccountId:
 *                   type: string
 *                 projectId:
 *                   type: string
 *                 projectName:
 *                   type: string
 *                 currency:
 *                   type: string
 *                 currentBalance:
 *                   type: string
 *                 lockedBalance:
 *                   type: string
 *                 yourTotalDeposited:
 *                   type: string
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *       404:
 *         description: Vault not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
const getProjectVaultDetails = async (req, res) => {
    try {
        const id = getParamId(req.params.escrowAccountId);
        if (!id)
            return res.status(400).json({ message: "escrowAccountId required" });
        const details = await escrow_service_1.WalletService.getProjectVaultBalance(req.user.id, id);
        if (!details)
            return res.status(404).json({ message: "Vault not found" });
        return res.json(details);
    }
    catch (error) {
        console.error("Get vault details error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getProjectVaultDetails = getProjectVaultDetails;
