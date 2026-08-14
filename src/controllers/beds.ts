import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { jsonError, jsonOk, resolveHospitalScope } from "@/utils/hospitalScope";
import { Response } from "express";

const bedInclude = {
  room: {
    include: {
      department: { select: { id: true, name: true } },
    },
  },
  admissions: {
    where: { status: "ACTIVE" as const },
    take: 1,
    include: {
      patient: {
        select: { id: true, name: true, fileNumber: true, phone: true },
      },
    },
  },
};

async function refreshRoomAvailability(roomId: string) {
  const free = await db.bed.count({
    where: { roomId, isOccupied: false },
  });
  await db.room.update({
    where: { id: roomId },
    data: { isAvailable: free > 0 },
  });
}

export async function getBeds(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonOk(res, []);
    }

    const availableOnly = String(req.query.available || "") === "true";

    const beds = await db.bed.findMany({
      where: {
        room: { hopitalId: hospitalId },
        ...(availableOnly ? { isOccupied: false } : {}),
      },
      orderBy: [{ bedNumber: "asc" }],
      include: bedInclude,
    });

    return jsonOk(res, beds);
  } catch (error) {
    console.error("getBeds", error);
    return jsonError(res, 500, "Impossible de récupérer les lits");
  }
}

export async function getBedById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const bed = await db.bed.findUnique({
      where: { id: req.params.id },
      include: bedInclude,
    });

    if (!bed) {
      return jsonError(res, 404, "Lit introuvable");
    }
    if (bed.room.hopitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    return jsonOk(res, bed);
  } catch (error) {
    console.error("getBedById", error);
    return jsonError(res, 500, "Impossible de récupérer le lit");
  }
}

export async function createBed(req: AuthRequest, res: Response) {
  const body = req.body as { bedNumber?: string; roomId?: string };

  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(
        res,
        400,
        "Aucun hôpital associé au compte. Impossible de créer un lit."
      );
    }

    const bedNumber = body.bedNumber?.trim();
    const roomId = body.roomId?.trim();
    if (!bedNumber || !roomId) {
      return jsonError(res, 400, "Numéro de lit et chambre sont requis");
    }

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return jsonError(res, 404, "Chambre introuvable");
    }
    if (room.hopitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const bed = await db.bed.create({
      data: {
        bedNumber,
        roomId,
        isOccupied: false,
      },
      include: bedInclude,
    });

    await refreshRoomAvailability(roomId);

    return jsonOk(res, bed, 201);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "P2002") {
      return jsonError(res, 409, "Ce numéro de lit existe déjà dans la chambre");
    }
    console.error("createBed", error);
    return jsonError(res, 500, "Impossible de créer le lit");
  }
}

export async function updateBed(req: AuthRequest, res: Response) {
  const body = req.body as {
    bedNumber?: string;
    isOccupied?: boolean;
    roomId?: string;
  };

  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const existing = await db.bed.findUnique({
      where: { id: req.params.id },
      include: { room: true },
    });
    if (!existing) {
      return jsonError(res, 404, "Lit introuvable");
    }
    if (existing.room.hopitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    if (body.roomId && body.roomId !== existing.roomId) {
      const nextRoom = await db.room.findUnique({ where: { id: body.roomId } });
      if (!nextRoom || nextRoom.hopitalId !== hospitalId) {
        return jsonError(res, 403, "Accès refusé");
      }
    }

    const bed = await db.bed.update({
      where: { id: existing.id },
      data: {
        bedNumber: body.bedNumber?.trim() || undefined,
        roomId: body.roomId || undefined,
        isOccupied:
          typeof body.isOccupied === "boolean" ? body.isOccupied : undefined,
      },
      include: bedInclude,
    });

    await refreshRoomAvailability(bed.roomId);
    if (existing.roomId !== bed.roomId) {
      await refreshRoomAvailability(existing.roomId);
    }

    return jsonOk(res, bed);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "P2002") {
      return jsonError(res, 409, "Ce numéro de lit existe déjà dans la chambre");
    }
    console.error("updateBed", error);
    return jsonError(res, 500, "Impossible de mettre à jour le lit");
  }
}

export async function deleteBed(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const existing = await db.bed.findUnique({
      where: { id: req.params.id },
      include: { room: true },
    });
    if (!existing) {
      return jsonError(res, 404, "Lit introuvable");
    }
    if (existing.room.hopitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    if (existing.isOccupied) {
      return jsonError(res, 409, "Impossible de supprimer un lit occupé");
    }

    await db.bed.delete({ where: { id: existing.id } });
    await refreshRoomAvailability(existing.roomId);

    return jsonOk(res, { id: existing.id });
  } catch (error) {
    console.error("deleteBed", error);
    return jsonError(res, 500, "Impossible de supprimer le lit");
  }
}
