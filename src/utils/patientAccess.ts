import crypto from "crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const PATIENT_ACCESS_OPTIONS: SignOptions = {
  expiresIn: "7d",
};

function accessSecret(): string {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET is not configured");
  }
  return secret;
}

export interface PatientTokenPayload {
  typ: "patient";
  patientId: string;
  fileNumber: string;
}

function qrHmac(patientId: string): string {
  return crypto
    .createHmac("sha256", accessSecret())
    .update(`patient-qr:${patientId}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}

/** Jeton stable pour le QR de la carte PVC (HMAC, pas d’expiration). */
export function signPatientQrToken(patientId: string): string {
  return `${patientId}.${qrHmac(patientId)}`;
}

export function verifyPatientQrToken(raw: string): string | null {
  const token = decodeURIComponent(String(raw || "").trim());
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const patientId = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1).toLowerCase();
  if (!patientId || !/^[A-Za-z0-9_-]+$/.test(patientId)) return null;
  if (!/^[a-f0-9]+$/.test(sig)) return null;
  const expected = qrHmac(patientId);
  if (sig.length !== expected.length) return null;
  try {
    const ok = crypto.timingSafeEqual(
      Buffer.from(sig, "utf8"),
      Buffer.from(expected, "utf8")
    );
    return ok ? patientId : null;
  } catch {
    return null;
  }
}

export function generatePatientAccessToken(
  payload: PatientTokenPayload
): string {
  return jwt.sign(
    {
      typ: "patient",
      patientId: payload.patientId,
      fileNumber: payload.fileNumber,
    },
    accessSecret(),
    PATIENT_ACCESS_OPTIONS
  );
}

export function verifyPatientAccessToken(token: string): PatientTokenPayload {
  const decoded = jwt.verify(token, accessSecret()) as JwtPayload;
  if (decoded.typ !== "patient" || typeof decoded.patientId !== "string") {
    throw new Error("not a patient token");
  }
  return {
    typ: "patient",
    patientId: decoded.patientId,
    fileNumber:
      typeof decoded.fileNumber === "string" ? decoded.fileNumber : "",
  };
}
