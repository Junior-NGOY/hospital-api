import { NextFunction, Request, Response } from "express";
import { verifyPatientAccessToken } from "@/utils/patientAccess";
import { TokenPayload, verifyAccessToken } from "@/utils/tokens";

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export interface PatientAuthRequest extends Request {
  patientId?: string;
  fileNumber?: string;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    return token || null;
  }
  return null;
}

/**
 * Verifies Authorization: Bearer <access JWT>.
 * Does not read cookies — the Next.js app stores tokens on the Vercel domain
 * and forwards them as Bearer on Server Actions (cross-origin with Railway).
 */
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      data: null,
      error: "Authentification requise"
    });
  }

  try {
    const payload = verifyAccessToken(token);
    if (payload.typ === "patient" || !payload.userId || !payload.role) {
      return res.status(401).json({
        data: null,
        error: "Jeton invalide ou expiré"
      });
    }
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({
      data: null,
      error: "Jeton invalide ou expiré"
    });
  }
}

/**
 * Session patient (QR ou n° dossier + téléphone). Distincte du JWT staff.
 * Un jeton patient ne passe jamais `authenticate`.
 */
export function authenticatePatient(
  req: PatientAuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      data: null,
      error: "Authentification patient requise"
    });
  }

  try {
    const payload = verifyPatientAccessToken(token);
    req.patientId = payload.patientId;
    req.fileNumber = payload.fileNumber;
    return next();
  } catch {
    return res.status(401).json({
      data: null,
      error: "Session patient invalide ou expirée"
    });
  }
}

/** Prisma UserRole. ADMINISTRATOR always passes (do not lock yourself out). */
export const ADMIN_ROLE = "ADMINISTRATOR";

/**
 * Mount after `authenticate`. Empty list = admin only.
 * Example: authenticate, requireRoles("ACCOUNTANT"), handler
 */
export function requireRoles(...allowed: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({
        data: null,
        error: "Authentification requise"
      });
    }
    if (role === ADMIN_ROLE || allowed.includes(role)) {
      return next();
    }
    return res.status(403).json({
      data: null,
      error: "Accès refusé pour ce rôle"
    });
  };
}
