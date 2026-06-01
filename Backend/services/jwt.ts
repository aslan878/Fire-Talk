import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "default_access_secret_fire_talk_123456";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default_refresh_secret_fire_talk_789012";

export interface TokenPayload {
  userId: string;
}

export function generateTokens(payload: TokenPayload) {
  const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
  } catch (e) {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
  } catch (e) {
    return null;
  }
}
