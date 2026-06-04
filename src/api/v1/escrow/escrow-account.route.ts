import { Router } from "express";
import {
  getMyWallet,
  getMyWalletHistory,
  initiateFunding,
  confirmFundingTest,
  transferToVault,
  listMyProjectVaults,
  getProjectVaultDetails,
} from "./escrow-account.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(requiredAuth);

router.get("/", getMyWallet);
router.get("/transactions", getMyWalletHistory);
router.post("/fund", requireRole("client"), initiateFunding);
router.post("/fund/:fundingId/confirm", requireRole("client", "admin"), confirmFundingTest);
router.post("/transfer-to-vault", requireRole("client"), transferToVault);
router.get("/project-vaults", listMyProjectVaults);
router.get("/project-vaults/:escrowAccountId", getProjectVaultDetails);

export default router;
