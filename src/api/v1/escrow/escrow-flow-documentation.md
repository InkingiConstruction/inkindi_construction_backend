Quick Reference: How the Escrow Now Works (InkingiPro v2)
Step	What happens	Where it lives
1. Fund Wallet	Client hits POST /fund → createFundingRequest() stores a pending row. Provider collects the money externally.	wallet.service.ts
2. Confirm	Provider webhook (or simulateFundingSuccess) hits POST /fund/:id/confirm → confirmFunding() atomically credits the wallet.	wallet.service.ts
3. Transfer to Vault	Client hits POST /transfer-to-vault → transferToVault() atomically debits wallet + credits escrow account + writes audit rows.	wallet.service.ts
4. Back Milestones	(Next layer) Escrow service uses vault balance to release payments to engineers on approved milestones.	escrow-account.service.ts
5. Disputes	(Next layer) Frozen / locked balance handled in escrow service.	escrow-account.service.ts