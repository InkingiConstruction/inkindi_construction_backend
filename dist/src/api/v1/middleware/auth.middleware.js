import { auth } from "../../../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { authenticatedUserRateLimit } from "./auth-security.middleware";
export const requiredAuth = async (req, res, next) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        if (!session) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        req.session = session;
        req.user = session.user;
        req.role = session.user.role;
        authenticatedUserRateLimit(req, res, next);
    }
    catch (error) {
        next(error);
    }
};
