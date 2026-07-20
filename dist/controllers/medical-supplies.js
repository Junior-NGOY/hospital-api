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
exports.createMedicalSupply = createMedicalSupply;
exports.getMedicalSupplies = getMedicalSupplies;
exports.getMedicalSupplyById = getMedicalSupplyById;
exports.updateMedicalSupply = updateMedicalSupply;
exports.deleteMedicalSupply = deleteMedicalSupply;
const db_1 = require("../db/db");
function toDate(value) {
    if (!value)
        return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
function deriveStatus(currentStock, minStock, explicit) {
    if (explicit)
        return explicit;
    if (currentStock <= 0)
        return "OUT_OF_STOCK";
    if (currentStock <= minStock)
        return "LOW_STOCK";
    return "IN_STOCK";
}
function createMedicalSupply(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            const data = req.body;
            if (!((_a = data.name) === null || _a === void 0 ? void 0 : _a.trim()) || !data.type || !data.unit) {
                return res.status(400).json({ data: null, error: "name, type et unit sont requis" });
            }
            if (String(data.type).toUpperCase() === "PHARMACEUTICAL") {
                return res.status(400).json({
                    data: null,
                    error: "Les produits pharmaceutiques se gèrent dans /medications",
                });
            }
            const currentStock = (_b = data.currentStock) !== null && _b !== void 0 ? _b : 0;
            const minStock = (_c = data.minStock) !== null && _c !== void 0 ? _c : 0;
            const created = yield db_1.db.medicalSupply.create({
                data: {
                    name: data.name.trim(),
                    type: data.type,
                    unit: data.unit,
                    hospitalId: data.hospitalId || null,
                    branchId: data.branchId || null,
                    brand: data.brand || null,
                    category: data.category || null,
                    description: data.description || null,
                    currentStock,
                    minStock,
                    maxStock: (_d = data.maxStock) !== null && _d !== void 0 ? _d : 0,
                    unitPrice: (_e = data.unitPrice) !== null && _e !== void 0 ? _e : 0,
                    expiryDate: toDate(data.expiryDate),
                    batchNumber: data.batchNumber || null,
                    supplier: data.supplier || null,
                    location: data.location || null,
                    status: deriveStatus(currentStock, minStock, data.status),
                },
            });
            return res.status(201).json({ data: created, error: null });
        }
        catch (error) {
            console.error("createMedicalSupply error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la création du consommable" });
        }
    });
}
function getMedicalSupplies(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { hospitalId, branchId, type, status, search, page = "1", limit = "50" } = req.query;
            const where = {};
            if (hospitalId)
                where.hospitalId = String(hospitalId);
            if (branchId)
                where.branchId = String(branchId);
            if (type)
                where.type = String(type);
            if (status)
                where.status = String(status);
            if (search) {
                where.OR = [
                    { name: { contains: String(search), mode: "insensitive" } },
                    { brand: { contains: String(search), mode: "insensitive" } },
                    { location: { contains: String(search), mode: "insensitive" } },
                ];
            }
            const skip = (Number(page) - 1) * Number(limit);
            const [supplies, total] = yield Promise.all([
                db_1.db.medicalSupply.findMany({
                    where,
                    orderBy: { updatedAt: "desc" },
                    skip,
                    take: Number(limit),
                }),
                db_1.db.medicalSupply.count({ where }),
            ]);
            return res.status(200).json({
                data: {
                    supplies,
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
            console.error("getMedicalSupplies error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la récupération des consommables" });
        }
    });
}
function getMedicalSupplyById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const item = yield db_1.db.medicalSupply.findUnique({ where: { id: req.params.id } });
            if (!item) {
                return res.status(404).json({ data: null, error: "Consommable introuvable" });
            }
            return res.status(200).json({ data: item, error: null });
        }
        catch (error) {
            console.error("getMedicalSupplyById error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la récupération du consommable" });
        }
    });
}
function updateMedicalSupply(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const data = req.body;
            const existing = yield db_1.db.medicalSupply.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ data: null, error: "Consommable introuvable" });
            }
            if (data.type && String(data.type).toUpperCase() === "PHARMACEUTICAL") {
                return res.status(400).json({
                    data: null,
                    error: "Les produits pharmaceutiques se gèrent dans /medications",
                });
            }
            const currentStock = data.currentStock !== undefined ? data.currentStock : existing.currentStock;
            const minStock = data.minStock !== undefined ? data.minStock : existing.minStock;
            const updated = yield db_1.db.medicalSupply.update({
                where: { id },
                data: {
                    name: data.name !== undefined ? data.name.trim() : undefined,
                    brand: data.brand !== undefined ? data.brand || null : undefined,
                    type: data.type !== undefined ? data.type : undefined,
                    category: data.category !== undefined ? data.category || null : undefined,
                    description: data.description !== undefined ? data.description || null : undefined,
                    unit: data.unit !== undefined ? data.unit : undefined,
                    currentStock: data.currentStock !== undefined ? data.currentStock : undefined,
                    minStock: data.minStock !== undefined ? data.minStock : undefined,
                    maxStock: data.maxStock !== undefined ? data.maxStock : undefined,
                    unitPrice: data.unitPrice !== undefined ? data.unitPrice : undefined,
                    expiryDate: data.expiryDate !== undefined ? toDate(data.expiryDate) : undefined,
                    batchNumber: data.batchNumber !== undefined ? data.batchNumber || null : undefined,
                    supplier: data.supplier !== undefined ? data.supplier || null : undefined,
                    location: data.location !== undefined ? data.location || null : undefined,
                    hospitalId: data.hospitalId !== undefined ? data.hospitalId || null : undefined,
                    branchId: data.branchId !== undefined ? data.branchId || null : undefined,
                    status: deriveStatus(currentStock, minStock, data.status),
                },
            });
            return res.status(200).json({ data: updated, error: null });
        }
        catch (error) {
            console.error("updateMedicalSupply error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la mise à jour du consommable" });
        }
    });
}
function deleteMedicalSupply(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const existing = yield db_1.db.medicalSupply.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ data: null, error: "Consommable introuvable" });
            }
            yield db_1.db.medicalSupply.delete({ where: { id } });
            return res.status(200).json({ data: { id }, error: null });
        }
        catch (error) {
            console.error("deleteMedicalSupply error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la suppression du consommable" });
        }
    });
}
