import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import {
  jsonError,
  jsonOk,
  requireHospitalForWrite,
  requirePatientInHospital,
  resolveHospitalScope,
} from "@/utils/hospitalScope";
import { resolveDoctorUser } from "@/utils/labOrders";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { Response } from "express";

const APPOINTMENT_STATUSES = new Set<string>(Object.values(AppointmentStatus));
const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
];

const APPOINTMENT_TYPES = new Set([
  "consultation",
  "follow-up",
  "emergency",
  "checkup",
  "procedure",
]);

const APPOINTMENT_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

const appointmentInclude = {
  patient: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      fileNumber: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
    },
  },
  doctor: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          isActive: true,
          hospitalId: true,
        },
      },
    },
  },
  branch: {
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
    },
  },
} satisfies Prisma.AppointmentInclude;

function parseStatus(raw?: unknown): AppointmentStatus | undefined {
  if (raw == null || raw === "") return undefined;
  const value = String(raw)
    .trim()
    .toUpperCase()
    .replace(/-/g, "_")
    .replace("NO_SHOW", "NO_SHOW")
    .replace("NOSHOW", "NO_SHOW");
  const mapped =
    value === "IN_PROGRESS" || value === "INPROGRESS"
      ? AppointmentStatus.CONFIRMED
      : value;
  if (!APPOINTMENT_STATUSES.has(mapped)) return undefined;
  return mapped as AppointmentStatus;
}

function parseDate(raw?: unknown): Date | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? undefined : raw;
  }
  const text = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseDuration(raw?: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(480, Math.max(15, n));
}

function parseType(raw?: unknown): string {
  const value = String(raw || "consultation").trim().toLowerCase();
  return APPOINTMENT_TYPES.has(value) ? value : "consultation";
}

function parsePriority(raw?: unknown): string {
  const value = String(raw || "normal").trim().toLowerCase();
  return APPOINTMENT_PRIORITIES.has(value) ? value : "normal";
}

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function overlaps(
  aStart: Date,
  aDuration: number,
  bStart: Date,
  bDuration: number
): boolean {
  const aEnd = aStart.getTime() + aDuration * 60_000;
  const bEnd = bStart.getTime() + bDuration * 60_000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}

async function findDoctorInHospital(
  doctorId: string,
  hospitalId: string
): Promise<{ id: string; userId: string } | null> {
  const info = await resolveDoctorUser(doctorId);
  if (!info.profileId) return null;
  const doctor = await db.doctor.findFirst({
    where: {
      id: info.profileId,
      user: { hospitalId },
    },
    select: { id: true, userId: true },
  });
  return doctor;
}

async function hasConflict(opts: {
  doctorId: string;
  scheduledDate: Date;
  duration: number;
  excludeId?: string;
}): Promise<boolean> {
  const { start, end } = dayBounds(opts.scheduledDate);
  const sameDay = await db.appointment.findMany({
    where: {
      doctorId: opts.doctorId,
      status: { in: BLOCKING_STATUSES },
      scheduledDate: { gte: start, lte: end },
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
    },
    select: { scheduledDate: true, duration: true },
  });
  return sameDay.some((apt) =>
    overlaps(opts.scheduledDate, opts.duration, apt.scheduledDate, apt.duration)
  );
}

async function loadScopedAppointment(
  req: AuthRequest,
  res: Response,
  id: string
): Promise<{
  hospitalId: string;
  appointment: Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;
} | null> {
  const { hospitalId } = await resolveHospitalScope(req);
  if (!hospitalId) {
    jsonError(res, 403, "Accès refusé");
    return null;
  }
  const appointment = await db.appointment.findUnique({
    where: { id },
    include: appointmentInclude,
  });
  if (!appointment) {
    jsonError(res, 404, "Rendez-vous introuvable");
    return null;
  }
  if (appointment.hospitalId !== hospitalId) {
    jsonError(res, 403, "Accès refusé");
    return null;
  }
  return { hospitalId, appointment };
}

export async function getAppointments(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);

    const patientId = req.query.patientId ? String(req.query.patientId) : undefined;
    const doctorId = req.query.doctorId ? String(req.query.doctorId) : undefined;
    const status = parseStatus(req.query.status);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const date = parseDate(req.query.date);
    const upcoming = String(req.query.upcoming || "") === "true";

    const scheduledDate: Prisma.DateTimeFilter = {};
    if (date) {
      const bounds = dayBounds(date);
      scheduledDate.gte = bounds.start;
      scheduledDate.lte = bounds.end;
    } else {
      if (from) scheduledDate.gte = from;
      if (to) scheduledDate.lte = to;
    }
    if (upcoming) {
      scheduledDate.gt = new Date();
    }

    let scopedDoctorId: string | undefined;
    if (doctorId) {
      const doctor = await findDoctorInHospital(doctorId, hospitalId);
      scopedDoctorId = doctor?.id;
      if (!scopedDoctorId) return jsonOk(res, []);
    }

    const appointments = await db.appointment.findMany({
      where: {
        hospitalId,
        ...(patientId ? { patientId } : {}),
        ...(scopedDoctorId ? { doctorId: scopedDoctorId } : {}),
        ...(status ? { status } : {}),
        ...(Object.keys(scheduledDate).length ? { scheduledDate } : {}),
        ...(upcoming
          ? { status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] } }
          : {}),
      },
      include: appointmentInclude,
      orderBy: { scheduledDate: upcoming ? "asc" : "desc" },
      take: 500,
    });

    return jsonOk(res, appointments);
  } catch (error) {
    console.error("getAppointments", error);
    return jsonError(res, 500, "Impossible de récupérer les rendez-vous");
  }
}

export async function getAppointmentById(req: AuthRequest, res: Response) {
  try {
    const scoped = await loadScopedAppointment(req, res, req.params.id);
    if (!scoped) return;
    return jsonOk(res, scoped.appointment);
  } catch (error) {
    console.error("getAppointmentById", error);
    return jsonError(res, 500, "Impossible de récupérer le rendez-vous");
  }
}

export async function getAppointmentDoctors(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);

    const doctors = await db.doctor.findMany({
      where: { user: { hospitalId, isActive: true } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
      },
      orderBy: { user: { lastName: "asc" } },
    });

    return jsonOk(
      res,
      doctors.map((d) => ({
        id: d.id,
        userId: d.userId,
        firstName: d.user.firstName,
        lastName: d.user.lastName,
        email: d.user.email,
        phone: d.user.phone,
        specialization: d.specialization,
        isActive: d.user.isActive,
      }))
    );
  } catch (error) {
    console.error("getAppointmentDoctors", error);
    return jsonError(res, 500, "Impossible de récupérer les médecins");
  }
}

export async function getDoctorSchedule(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonOk(res, { doctorId: "", date: "", timeSlots: [] });
    }

    const doctorIdRaw = String(req.query.doctorId || "");
    const date = parseDate(req.query.date);
    if (!doctorIdRaw || !date) {
      return jsonError(res, 400, "Médecin et date sont requis");
    }

    const doctor = await findDoctorInHospital(doctorIdRaw, hospitalId);
    if (!doctor) {
      return jsonOk(res, {
        doctorId: doctorIdRaw,
        date: date.toISOString().slice(0, 10),
        timeSlots: [],
      });
    }

    const { start, end } = dayBounds(date);
    const appointments = await db.appointment.findMany({
      where: {
        hospitalId,
        doctorId: doctor.id,
        status: { in: BLOCKING_STATUSES },
        scheduledDate: { gte: start, lte: end },
      },
      select: { id: true, scheduledDate: true, duration: true },
    });

    const timeSlots: Array<{
      time: string;
      available: boolean;
      appointmentId?: string;
    }> = [];
    for (let hour = 8; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slot = new Date(date);
        slot.setHours(hour, minute, 0, 0);
        const hit = appointments.find((apt) =>
          overlaps(slot, 30, apt.scheduledDate, apt.duration)
        );
        timeSlots.push({
          time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
          available: !hit,
          appointmentId: hit?.id,
        });
      }
    }

    return jsonOk(res, {
      doctorId: doctor.id,
      date: date.toISOString().slice(0, 10),
      timeSlots,
    });
  } catch (error) {
    console.error("getDoctorSchedule", error);
    return jsonError(res, 500, "Impossible de récupérer les créneaux");
  }
}

export async function createAppointment(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;

    const body = req.body as Record<string, unknown>;
    const patientId = String(body.patientId || "").trim();
    const doctorIdRaw = String(body.doctorId || "").trim();
    if (!patientId) return jsonError(res, 400, "Le patient est requis");
    if (!doctorIdRaw) {
      return jsonError(
        res,
        400,
        "Un médecin réel est requis. Aucun médecin fictif n’est proposé."
      );
    }

    const scheduledDate = parseDate(body.scheduledDate);
    if (!scheduledDate) {
      return jsonError(res, 400, "La date du rendez-vous est requise");
    }

    const scopedPatient = await requirePatientInHospital(req, res, patientId);
    if (!scopedPatient) return;

    const doctor = await findDoctorInHospital(doctorIdRaw, scope.hospitalId);
    if (!doctor) {
      return jsonError(
        res,
        400,
        "Médecin introuvable pour cet hôpital. Créez un utilisateur au rôle Médecin."
      );
    }

    const duration = parseDuration(body.duration) ?? 30;
    if (await hasConflict({ doctorId: doctor.id, scheduledDate, duration })) {
      return jsonError(res, 409, "Créneau déjà occupé pour ce médecin");
    }

    let branchId = scope.branchId;
    const requestedBranch = body.branchId ? String(body.branchId).trim() : "";
    if (requestedBranch) {
      const branch = await db.hospitalBranch.findFirst({
        where: { id: requestedBranch, hospitalId: scope.hospitalId },
        select: { id: true },
      });
      if (!branch) return jsonError(res, 403, "Accès refusé");
      branchId = branch.id;
    }

    const created = await db.appointment.create({
      data: {
        patientId,
        doctorId: doctor.id,
        hospitalId: scope.hospitalId,
        branchId,
        scheduledDate,
        duration,
        status: parseStatus(body.status) ?? AppointmentStatus.SCHEDULED,
        reason: body.reason ? String(body.reason).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        type: parseType(body.type),
        priority: parsePriority(body.priority),
      },
      include: appointmentInclude,
    });

    return jsonOk(res, created, 201);
  } catch (error) {
    console.error("createAppointment", error);
    return jsonError(res, 500, "Impossible de créer le rendez-vous");
  }
}

export async function updateAppointment(req: AuthRequest, res: Response) {
  try {
    const scoped = await loadScopedAppointment(req, res, req.params.id);
    if (!scoped) return;

    const body = req.body as Record<string, unknown>;
    const data: Prisma.AppointmentUpdateInput = {};

    if (body.patientId) {
      const patientId = String(body.patientId).trim();
      const patient = await requirePatientInHospital(req, res, patientId);
      if (!patient) return;
      data.patient = { connect: { id: patientId } };
    }

    if (body.doctorId) {
      const doctor = await findDoctorInHospital(
        String(body.doctorId),
        scoped.hospitalId
      );
      if (!doctor) {
        return jsonError(
          res,
          400,
          "Médecin introuvable pour cet hôpital. Créez un utilisateur au rôle Médecin."
        );
      }
      data.doctor = { connect: { id: doctor.id } };
    }

    const scheduledDate = parseDate(body.scheduledDate);
    if (scheduledDate) data.scheduledDate = scheduledDate;
    const duration = parseDuration(body.duration);
    if (duration) data.duration = duration;
    if (body.reason !== undefined) {
      data.reason = body.reason ? String(body.reason).trim() : null;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes ? String(body.notes).trim() : null;
    }
    if (body.type !== undefined) data.type = parseType(body.type);
    if (body.priority !== undefined) data.priority = parsePriority(body.priority);
    const status = parseStatus(body.status);
    if (status) data.status = status;

    if (body.branchId !== undefined) {
      const requestedBranch = String(body.branchId || "").trim();
      if (!requestedBranch) {
        data.branch = { disconnect: true };
      } else {
        const branch = await db.hospitalBranch.findFirst({
          where: { id: requestedBranch, hospitalId: scoped.hospitalId },
          select: { id: true },
        });
        if (!branch) return jsonError(res, 403, "Accès refusé");
        data.branch = { connect: { id: branch.id } };
      }
    }

    const nextDoctorId =
      body.doctorId && typeof data.doctor === "object" && data.doctor && "connect" in data.doctor
        ? (data.doctor.connect as { id: string }).id
        : scoped.appointment.doctorId;
    const nextDate = scheduledDate ?? scoped.appointment.scheduledDate;
    const nextDuration = duration ?? scoped.appointment.duration;
    const nextStatus = status ?? scoped.appointment.status;
    if (BLOCKING_STATUSES.includes(nextStatus)) {
      if (
        await hasConflict({
          doctorId: nextDoctorId,
          scheduledDate: nextDate,
          duration: nextDuration,
          excludeId: scoped.appointment.id,
        })
      ) {
        return jsonError(res, 409, "Créneau déjà occupé pour ce médecin");
      }
    }

    const updated = await db.appointment.update({
      where: { id: scoped.appointment.id },
      data,
      include: appointmentInclude,
    });
    return jsonOk(res, updated);
  } catch (error) {
    console.error("updateAppointment", error);
    return jsonError(res, 500, "Impossible de modifier le rendez-vous");
  }
}

export async function cancelAppointment(req: AuthRequest, res: Response) {
  try {
    const scoped = await loadScopedAppointment(req, res, req.params.id);
    if (!scoped) return;

    if (scoped.appointment.status === AppointmentStatus.CANCELLED) {
      return jsonOk(res, scoped.appointment);
    }
    if (scoped.appointment.status === AppointmentStatus.COMPLETED) {
      return jsonError(res, 409, "Un rendez-vous terminé ne peut pas être annulé");
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const notePrefix = reason ? `Annulé: ${reason}` : "Annulé";
    const existingNotes = scoped.appointment.notes?.trim();
    const notes = existingNotes
      ? `${existingNotes}\n\n${notePrefix}`
      : notePrefix;

    const updated = await db.appointment.update({
      where: { id: scoped.appointment.id },
      data: { status: AppointmentStatus.CANCELLED, notes },
      include: appointmentInclude,
    });
    return jsonOk(res, updated);
  } catch (error) {
    console.error("cancelAppointment", error);
    return jsonError(res, 500, "Impossible d’annuler le rendez-vous");
  }
}

export async function confirmAppointment(req: AuthRequest, res: Response) {
  try {
    const scoped = await loadScopedAppointment(req, res, req.params.id);
    if (!scoped) return;
    if (scoped.appointment.status === AppointmentStatus.CANCELLED) {
      return jsonError(res, 409, "Un rendez-vous annulé ne peut pas être confirmé");
    }
    const updated = await db.appointment.update({
      where: { id: scoped.appointment.id },
      data: { status: AppointmentStatus.CONFIRMED },
      include: appointmentInclude,
    });
    return jsonOk(res, updated);
  } catch (error) {
    console.error("confirmAppointment", error);
    return jsonError(res, 500, "Impossible de confirmer le rendez-vous");
  }
}

export async function deleteAppointment(req: AuthRequest, res: Response) {
  try {
    const scoped = await loadScopedAppointment(req, res, req.params.id);
    if (!scoped) return;
    await db.appointment.delete({ where: { id: scoped.appointment.id } });
    return jsonOk(res, { id: scoped.appointment.id });
  } catch (error) {
    console.error("deleteAppointment", error);
    return jsonError(res, 500, "Impossible de supprimer le rendez-vous");
  }
}
