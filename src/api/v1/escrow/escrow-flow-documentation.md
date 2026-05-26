# InkingiPro - Escrow Payment Flow Architecture

## Overview
The Escrow module acts as the financial trust engine for InkingiPro. It ensures that Clients can safely deposit funds and Engineers/Suppliers are guaranteed payment upon verified completion of milestones.

## The Full Lifecycle Flow

### 1. Funding the Escrow (Deposit)
- **Action**: Client initiates a deposit to fund the project budget.
- **Provider**: Stripe (Cards) or MTN Momo (Mobile Money).
- **Backend Flow**:
  1. Client calls `POST /api/v1/escrow-accounts/:id/deposit-stripe` or `deposit-mtn`.
  2. Backend securely generates a `client_secret` (Stripe) or sends a USSD prompt (MTN Momo).
  3. The payment remains `pending` in the `Transaction` table.
- **Completion**: A Webhook (from Stripe/MTN) confirms successful payment, updating the Escrow Account's `balance` and marking the transaction as `completed`.

### 2. Milestone Creation & Engineer Work
- **Action**: Engineer creates Milestones adding up to 100% of the project budget.
- **Action**: Client approves milestones.
- **Context**: The Escrow balance sits securely. It is NOT transferred to the Engineer yet.

### 3. Payment Request & Inspection (The Trust Check)
- **Action**: Engineer finishes a milestone and requests payment.
- **Action**: Supervisor performs a site inspection (GPS verified, photo checklist).
- **Context**: The milestone status changes to `pending_supervisor`, then `awaiting_client_payment`.

### 4. Releasing Funds (The Payout)
- **Action**: Client reviews the inspection report and clicks "Approve Payment".
- **Backend Flow**:
  1. Backend deducts the approved amount from the Escrow `balance`.
  2. A new `release` Transaction is created.
  3. The money is transferred to the Engineer's connected bank/mobile money account (via Stripe Connect or MTN Momo Remittance API).
  4. Milestone is marked as `paid`.

### 5. Dispute Handling (The Safety Net)
- **Action**: If the Client rejects the work, they initiate a Dispute.
- **Backend Flow**:
  1. Escrow funds for that milestone are deducted from `balance` and moved to `lockedBalance` (Freeze transaction).
  2. Funds cannot be withdrawn until Admin resolves the dispute.
  3. Admin decision either Unfreezes funds (returns to `balance`) or processes a Refund/Penalty.

## Key Principles Applied
- **SOLID**: Providers (Stripe/MTN) are isolated in services.
- **DRY**: Shared transaction calculation logic (apply/reverse).
- **KISS**: Clear separation between `balance` (available) and `lockedBalance` (disputed).
