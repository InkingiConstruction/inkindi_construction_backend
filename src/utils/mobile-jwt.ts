import jwt from "jsonwebtoken";

type MobileJwtPayload = {
  sub: string;
  role?: string | null;
  exp: number;
};

const getSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.MOBILE_JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET or MOBILE_JWT_SECRET is required");
  }

  return secret;
};

export const createMobileJwt = (payload: { sub: string; role?: string | null }) =>
  jwt.sign(
    {
      sub: payload.sub,
      role: payload.role,
    },
    getSecret(),
    {
      algorithm: "HS256",
      expiresIn: "30d",
    },
  );

export const verifyMobileJwt = (token: string): MobileJwtPayload | null => {
  try {
    const payload = jwt.verify(token, getSecret(), {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;

    if (!payload.sub || typeof payload.sub !== "string" || !payload.exp) {
      return null;
    }

    return {
      sub: payload.sub,
      role: typeof payload.role === "string" ? payload.role : null,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
};
