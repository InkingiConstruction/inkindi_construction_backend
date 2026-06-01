import crypto from "crypto";

type MobileJwtPayload = {
  sub: string;
  role?: string | null;
  exp: number;
};

const getSecret = () => {
  const secret = process.env.MOBILE_JWT_SECRET || process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("MOBILE_JWT_SECRET or BETTER_AUTH_SECRET is required");
  }

  return secret;
};

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const sign = (value: string) =>
  crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const createMobileJwt = (payload: { sub: string; role?: string | null }) => {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({
    sub: payload.sub,
    role: payload.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  });
  const unsignedToken = `${header}.${body}`;

  return `${unsignedToken}.${sign(unsignedToken)}`;
};

export const verifyMobileJwt = (token: string): MobileJwtPayload | null => {
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) {
    return null;
  }

  const expectedSignature = sign(`${header}.${body}`);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as MobileJwtPayload;

    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
