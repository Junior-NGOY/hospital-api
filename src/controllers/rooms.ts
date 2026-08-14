import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { jsonError, jsonOk, resolveHospitalScope } from "@/utils/hospitalScope";
import { RoomCategory, RoomType } from "@prisma/client";
import { Response } from "express";

const ROOM_TYPES = new Set<string>(Object.values(RoomType));
const ROOM_CATEGORIES = new Set<string>(Object.values(RoomCategory));

function categoryFromType(type: RoomType): RoomCategory {
  if (ROOM_CATEGORIES.has(type)) {
    return type as unknown as RoomCategory;
  }
  return RoomCategory.GENERAL;
}

const roomInclude = {
  department: { select: { id: true, name: true } },
  beds: {
    include: {
      admissions: {
        where: { status: "ACTIVE" as const },
        take: 1,
        include: {
          patient: {
            select: { id: true, name: true, fileNumber: true },
          },
        },
      },
    },
    orderBy: { bedNumber: "asc" as const },
  },
};

function belongsToHospital(
  room: { hopitalId: string | null },
  hospitalId: string
): boolean {
  return room.hopitalId === hospitalId;
}

export async function getRooms(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonOk(res, []);
    }

    const rooms = await db.room.findMany({
      where: { hopitalId: hospitalId },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
      include: roomInclude,
    });

    return jsonOk(res, rooms);
  } catch (error) {
    console.error("getRooms", error);
    return jsonError(res, 500, "Impossible de récupérer les chambres");
  }
}

export async function getRoomById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const room = await db.room.findUnique({
      where: { id: req.params.id },
      include: roomInclude,
    });

    if (!room) {
      return jsonError(res, 404, "Chambre introuvable");
    }
    if (!belongsToHospital(room, hospitalId)) {
      return jsonError(res, 403, "Accès refusé");
    }

    return jsonOk(res, room);
  } catch (error) {
    console.error("getRoomById", error);
    return jsonError(res, 500, "Impossible de récupérer la chambre");
  }
}

export async function createRoom(req: AuthRequest, res: Response) {
  const body = req.body as {
    roomNumber?: string;
    type?: string;
    capacity?: number;
    floor?: number;
    departmentId?: string;
    roomCategory?: string;
    branchId?: string;
  };

  try {
    const { hospitalId, branchId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(
        res,
        400,
        "Aucun hôpital associé au compte. Impossible de créer une chambre."
      );
    }

    const roomNumber = body.roomNumber?.trim();
    const type = body.type as RoomType | undefined;
    const departmentId = body.departmentId?.trim();
    const floor = Number(body.floor);
    const capacity = Number(body.capacity ?? 1);

    if (!roomNumber || !type || !departmentId || !Number.isFinite(floor)) {
      return jsonError(
        res,
        400,
        "Numéro de chambre, type, étage et département sont requis"
      );
    }
    if (!ROOM_TYPES.has(type)) {
      return jsonError(res, 400, "Type de chambre invalide");
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      return jsonError(res, 400, "La capacité doit être au moins 1");
    }

    const department = await db.department.findUnique({
      where: { id: departmentId },
      select: { id: true, hospitalId: true },
    });
    if (!department) {
      return jsonError(res, 404, "Département introuvable");
    }
    if (department.hospitalId && department.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const roomCategory = ROOM_CATEGORIES.has(body.roomCategory || "")
      ? (body.roomCategory as RoomCategory)
      : categoryFromType(type);

    const room = await db.room.create({
      data: {
        roomNumber,
        type,
        capacity,
        floor,
        departmentId,
        roomCategory,
        hopitalId: hospitalId,
        branchId: body.branchId || branchId || null,
        isAvailable: true,
      },
      include: roomInclude,
    });

    return jsonOk(res, room, 201);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "P2002") {
      return jsonError(res, 409, "Une chambre avec ce numéro existe déjà");
    }
    console.error("createRoom", error);
    return jsonError(res, 500, "Impossible de créer la chambre");
  }
}

export async function updateRoom(req: AuthRequest, res: Response) {
  const body = req.body as {
    roomNumber?: string;
    type?: string;
    capacity?: number;
    floor?: number;
    departmentId?: string;
    roomCategory?: string;
    isAvailable?: boolean;
  };

  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const existing = await db.room.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return jsonError(res, 404, "Chambre introuvable");
    }
    if (!belongsToHospital(existing, hospitalId)) {
      return jsonError(res, 403, "Accès refusé");
    }

    if (body.type && !ROOM_TYPES.has(body.type)) {
      return jsonError(res, 400, "Type de chambre invalide");
    }
    if (body.roomCategory && !ROOM_CATEGORIES.has(body.roomCategory)) {
      return jsonError(res, 400, "Catégorie de chambre invalide");
    }

    const room = await db.room.update({
      where: { id: existing.id },
      data: {
        roomNumber: body.roomNumber?.trim() || undefined,
        type: body.type as RoomType | undefined,
        capacity:
          body.capacity !== undefined ? Number(body.capacity) : undefined,
        floor: body.floor !== undefined ? Number(body.floor) : undefined,
        departmentId: body.departmentId || undefined,
        roomCategory: body.roomCategory as RoomCategory | undefined,
        isAvailable:
          typeof body.isAvailable === "boolean" ? body.isAvailable : undefined,
      },
      include: roomInclude,
    });

    return jsonOk(res, room);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "P2002") {
      return jsonError(res, 409, "Une chambre avec ce numéro existe déjà");
    }
    console.error("updateRoom", error);
    return jsonError(res, 500, "Impossible de mettre à jour la chambre");
  }
}

export async function deleteRoom(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const existing = await db.room.findUnique({
      where: { id: req.params.id },
      include: { beds: true },
    });
    if (!existing) {
      return jsonError(res, 404, "Chambre introuvable");
    }
    if (!belongsToHospital(existing, hospitalId)) {
      return jsonError(res, 403, "Accès refusé");
    }
    if (existing.beds.some((bed) => bed.isOccupied)) {
      return jsonError(
        res,
        409,
        "Impossible de supprimer une chambre avec un lit occupé"
      );
    }

    await db.bed.deleteMany({ where: { roomId: existing.id } });
    await db.room.delete({ where: { id: existing.id } });

    return jsonOk(res, { id: existing.id });
  } catch (error) {
    console.error("deleteRoom", error);
    return jsonError(res, 500, "Impossible de supprimer la chambre");
  }
}
