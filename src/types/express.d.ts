import { auth } from "../lib/auth";

type BetterAuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

declare global {
  namespace Express {
    interface Request {
      session?: BetterAuthSession;
      user?: BetterAuthSession["user"];
      role?: BetterAuthSession["user"]["role"];
    }
  }
}
