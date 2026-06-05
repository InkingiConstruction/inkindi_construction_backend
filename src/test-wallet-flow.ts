/**
 * E2E test for wallet + vault + milestone payout
 * Run: npx tsx src/scripts/test-wallet-flow.ts
 */
import { PrismaClient } from "@prisma/client";
import { WalletService } from "./api/v1/escrow/escrow.service";
import { MilestoneService } from "./api/v1/milestones/milestone.service";

const prisma = new PrismaClient();

async function main() {
  console.log("🧪 Starting wallet flow test...\n");

  // Setup: find or create a client + project + milestone
  const client = await prisma.user.findFirst({ where: { role: "client" } });
  if (!client) throw new Error("No client user found — seed first");

  const project = await prisma.project.findFirst({
    where: { clientId: client.id },
    include: { escrowAccount: true, milestones: true },
  });
  if (!project) throw new Error("No project for this client");

  let escrow = project.escrowAccount;
  if (!escrow) {
    escrow = await prisma.escrowAccount.create({
      data: { projectId: project.id, currency: project.currency },
    });
  }

  // STEP 1: Ensure wallet exists
  console.log("STEP 1: Ensure wallet exists");
  const wallet = await WalletService.ensureWallet(client.id);
  console.log(`   ✓ Wallet created: ${wallet.id}, balance: ${wallet.balance}\n`);

  // STEP 2: Create funding request
  console.log("STEP 2: Initiate funding (100,000 RWF)");
  const funding = await WalletService.createFundingRequest({
    userId: client.id,
    amount: 100000,
    method: "stripe",
  });
  console.log(`   ✓ Funding request: ${funding.id}, status: ${funding.status}\n`);

  // STEP 3: Simulate provider confirmation
  console.log("STEP 3: Simulate provider confirmation");
  const confirmed = await WalletService.simulateFundingSuccess(funding.id);
  console.log(`   ✓ Wallet balance: ${confirmed.wallet.balance} ${confirmed.wallet.currency}\n`);

  // STEP 4: Transfer to vault
  console.log("STEP 4: Transfer 70,000 RWF to project vault");
  const transfer = await WalletService.transferToVault({
    userId: client.id,
    escrowAccountId: escrow.id,
    amount: 70000,
    description: "Test vault funding",
  });
  console.log(`   ✓ Transfer: ${transfer.amount} to ${transfer.escrowAccountId}\n`);

  // STEP 5: Check wallet summary
  console.log("STEP 5: Check wallet summary");
  const summary = await WalletService.getWallet(client.id);
  console.log(`   ✓ Available balance: ${summary?.availableBalance}`);
  console.log(`   ✓ In project vaults: ${summary?.totalInProjectVaults}\n`);

  // STEP 6: List user vaults
  console.log("STEP 6: List user project vaults");
  const vaults = await WalletService.listUserProjectVaults(client.id);
  console.log(`   ✓ Found ${vaults.length} vault(s):`);
  vaults.forEach((v) => {
    console.log(`     - ${v.projectName}: deposited=${v.yourDeposits}, balance=${v.currentBalance}`);
  });
  console.log();

  // STEP 7: Inspect project vault details
  console.log("STEP 7: Get specific vault details");
  const details = await WalletService.getProjectVaultBalance(client.id, escrow.id);
  console.log(`   ✓ Vault ${details?.escrowAccountId}`);
  console.log(`   ✓ Project: ${details?.projectName}`);
  console.log(`   ✓ Your total deposited: ${details?.yourTotalDeposited}\n`);

  // STEP 8: Test milestone payout
  const milestone = project.milestones[0];
  if (milestone) {
    console.log(`STEP 8: Release milestone payout (${milestone.name})`);
    // First, ensure vault has funds (top up if needed)
    const currentEscrow = await prisma.escrowAccount.findUnique({ where: { id: escrow.id } });
    if (currentEscrow && currentEscrow.balance.lt(50000)) {
      await WalletService.transferToVault({
        userId: client.id,
        escrowAccountId: escrow.id,
        amount: 100000,
        description: "Top up for payout test",
      });
    }
    const release = await MilestoneService.releaseMilestoneFunds(milestone.id, client.id, "client");
    console.log(`   ✓ Released ${release.payoutAmount} to engineer ${release.engineerId}\n`);
  }

  console.log("✅ All tests passed!");
}

main()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
