"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMaintenance = createMaintenance;
exports.getMaintenance = getMaintenance;
exports.getMaintenanceById = getMaintenanceById;
exports.updateMaintenance = updateMaintenance;
exports.completeMaintenance = completeMaintenance;
exports.deleteMaintenance = deleteMaintenance;
const db_1 = require("../db/db");
function toDate(value) {
    if (!value)
        return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
function createMaintenance(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const data = req.body;
            if (!data.equipmentId || !((_a = data.description) === null || _a === void 0 ? void 0 : _a.trim()) || !data.type || !data.scheduledDate) {
                return res.status(400).json({
                    data: null,
                    error: "equipmentId, type, description et scheduledDate sont requis",
                });
            }
            const equipment = yield db_1.db.equipment.findUnique({ where: { id: data.equipmentId } });
            if (!equipment) {
                return res.status(404).json({ data: null, error: "Équipement introuvable" });
            }
            const scheduledDate = toDate(data.scheduledDate);
            if (!scheduledDate) {
                return res.status(400).json({ data: null, error: "Date planifiée invalide" });
            }
            const created = yield db_1.db.maintenanceRecord.create({
                data: {
                    equipmentId: data.equipmentId,
                    type: data.type,
                    priority: data.priority || "MEDIUM",
                    description: data.description.trim(),
                    scheduledDate,
                    performedBy: data.performedBy || null,
                    cost: (_b = data.cost) !== null && _b !== void 0 ? _b : null,
                    notes: data.notes || null,
                    status: data.status || "SCHEDULED",
                },
                include: { equipment: true },
            });
            yield db_1.db.equipment.update({
                where: { id: data.equipmentId },
                data: {
                    nextMaintenanceDate: scheduledDate,
                    status: data.type === "EMERGENCY" || data.type === "CORRECTIVE" ? "MAINTENANCE" : equipment.status,
                },
            });
            return res.status(201).json({ data: created, error: null });
        }
        catch (error) {
            console.error("createMaintenance error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la création de la maintenance" });
        }
    });
}
function getMaintenance(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { equipmentId, status, type, hospitalId, page = "1", limit = "50" } = req.query;
            const where = {};
            if (equipmentId)
                where.equipmentId = String(equipmentId);
            if (status)
                where.status = String(status);
            if (type)
                where.type = String(type);
            if (hospitalId) {
                where.equipment = { hospitalId: String(hospitalId) };
            }
            const skip = (Number(page) - 1) * Number(limit);
            const [records, total] = yield Promise.all([
                db_1.db.maintenanceRecord.findMany({
                    where,
                    include: { equipment: true },
                    orderBy: { scheduledDate: "desc" },
                    skip,
                    take: Number(limit),
                }),
                db_1.db.maintenanceRecord.count({ where }),
            ]);
            return res.status(200).json({
                data: {
                    records,
                    pagination: {
                        total,
                        page: Number(page),
                        limit: Number(limit),
                        totalPages: Math.ceil(total / Number(limit)) || 1,
                    },
                },
                error: null,
            });
        }
        catch (error) {
            console.error("getMaintenance error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la récupération des maintenances" });
        }
    });
}
function getMaintenanceById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const record = yield db_1.db.maintenanceRecord.findUnique({
                where: { id },
                include: { equipment: true },
            });
            if (!record) {
                return res.status(404).json({ data: null, error: "Maintenance introuvable" });
            }
            return res.status(200).json({ data: record, error: null });
        }
        catch (error) {
            console.error("getMaintenanceById error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la récupération de la maintenance" });
        }
    });
}
function updateMaintenance(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { id } = req.params;
            const data = req.body;
            const existing = yield db_1.db.maintenanceRecord.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ data: null, error: "Maintenance introuvable" });
            }
            const updated = yield db_1.db.maintenanceRecord.update({
                where: { id },
                data: {
                    type: data.type !== undefined ? data.type : undefined,
                    priority: data.priority !== undefined ? data.priority : undefined,
                    description: data.description !== undefined ? data.description.trim() : undefined,
                    scheduledDate: data.scheduledDate !== undefined ? (_a = toDate(data.scheduledDate)) !== null && _a !== void 0 ? _a : undefined : undefined,
                    completedDate: data.completedDate !== undefined ? toDate(data.completedDate) : undefined,
                    performedBy: data.performedBy !== undefined ? data.performedBy || null : undefined,
                    cost: data.cost !== undefined ? data.cost : undefined,
                    notes: data.notes !== undefined ? data.notes || null : undefined,
                    status: data.status !== undefined ? data.status || undefined : undefined,
                },
                include: { equipment: true },
            });
            return res.status(200).json({ data: updated, error: null });
        }
        catch (error) {
            console.error("updateMaintenance error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la mise à jour de la maintenance" });
        }
    });
}
function completeMaintenance(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { notes, cost, performedBy } = req.body;
            const existing = yield db_1.db.maintenanceRecord.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ data: null, error: "Maintenance introuvable" });
            }
            const completedDate = new Date();
            const updated = yield db_1.db.maintenanceRecord.update({
                where: { id },
                data: {
                    status: "COMPLETED",
                    completedDate,
                    notes: notes !== undefined ? notes : existing.notes,
                    cost: cost !== undefined ? cost : existing.cost,
                    performedBy: performedBy !== undefined ? performedBy : existing.performedBy,
                },
                include: { equipment: true },
            });
            yield db_1.db.equipment.update({
                where: { id: existing.equipmentId },
                data: {
                    lastMaintenanceDate: completedDate,
                    status: "OPERATIONAL",
                },
            });
            return res.status(200).json({ data: updated, error: null });
        }
        catch (error) {
            console.error("completeMaintenance error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la clôture de la maintenance" });
        }
    });
}
function deleteMaintenance(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const existing = yield db_1.db.maintenanceRecord.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ data: null, error: "Maintenance introuvable" });
            }
            yield db_1.db.maintenanceRecord.delete({ where: { id } });
            return res.status(200).json({ data: { id }, error: null });
        }
        catch (error) {
            console.error("deleteMaintenance error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la suppression de la maintenance" });
        }
    });
}
