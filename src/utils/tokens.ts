import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const ACCESS_TOKEN_OPTIONS: SignOptions = {
  expiresIn: "60m"
};

const REFRESH_TOKEN_OPTIONS: SignOptions = {
  expiresIn: "30d"
};

export interface TokenPayload extends JwtPayload {
  /** Staff tokens omit typ (or typ=staff). Patient portal tokens use typ=patient. */
  typ?: string;
  userId: string;
  email: string;
  role: string;
  hospitalId?: string | null;
  branchId?: string | null;
}

function requireSecret(name: "ACCESS_TOKEN_SECRET" | "REFRESH_TOKEN_SECRET"): string {
  const secret = process.env[name];
  if (!secret) {
    throw new Error(`${name} is not configured`);
  }
  return secret;
}

function toJwtClaims(payload: TokenPayload) {
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    hospitalId: payload.hospitalId ?? null,
    branchId: payload.branchId ?? null
  };
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(toJwtClaims(payload), requireSecret("ACCESS_TOKEN_SECRET"), ACCESS_TOKEN_OPTIONS);
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(toJwtClaims(payload), requireSecret("REFRESH_TOKEN_SECRET"), REFRESH_TOKEN_OPTIONS);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, requireSecret("ACCESS_TOKEN_SECRET")) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, requireSecret("REFRESH_TOKEN_SECRET")) as TokenPayload;
}
