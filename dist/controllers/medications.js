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
exports.createMedication = createMedication;
exports.getMedications = getMedications;
exports.getMedicationById = getMedicationById;
exports.updateMedication = updateMedication;
exports.deleteMedication = deleteMedication;
exports.adjustMedicationStock = adjustMedicationStock;
const db_1 = require("../db/db");
function createMedication(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            const data = req.body;
            if (!((_a = data.name) === null || _a === void 0 ? void 0 : _a.trim())) {
                return res.status(400).json({
                    data: null,
                    error: "Le nom du médicament est requis",
                });
            }
            const existingMedication = yield db_1.db.medication.findFirst({
                where: {
                    name: data.name,
                    form: (_b = data.form) !== null && _b !== void 0 ? _b : undefined,
                },
            });
            if (existingMedication) {
                return res.status(400).json({
                    data: null,
                    error: "Un médicament avec ce nom et cette forme existe déjà",
                });
            }
            const newMedication = yield db_1.db.medication.create({
                data: {
                    name: data.name.trim(),
                    form: data.form || null,
                    stock: (_c = data.stock) !== null && _c !== void 0 ? _c : 0,
                    supplierId: data.supplierId || null,
                    hospitalId: data.hospitalId || null,
                },
                include: {
                    supplier: true,
                    hospital: true,
                },
            });
            return res.status(201).json({
                data: newMedication,
                error: null,
            });
        }
        catch (error) {
            console.error("Error creating medication:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la création du médicament",
            });
        }
    });
}
function getMedications(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { search, inStock, sort = "name", order = "asc", page = 1, limit = 100, } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const where = {};
            if (search) {
                where.name = { contains: search, mode: "insensitive" };
            }
            if (inStock === "true") {
                where.stock = { gt: 0 };
            }
            const allowedSort = ["name", "stock", "id"];
            const sortField = allowedSort.includes(String(sort)) ? String(sort) : "name";
            const sortOrder = order === "desc" ? "desc" : "asc";
            const medications = yield db_1.db.medication.findMany({
                where,
                include: {
                    supplier: true,
                    hospital: true,
                },
                orderBy: { [sortField]: sortOrder },
                skip,
                take: Number(limit),
            });
            const total = yield db_1.db.medication.count({ where });
            return res.status(200).json({
                data: {
                    medications,
                    pagination: {
                        total,
                        page: Number(page),
                        limit: Number(limit),
                        totalPages: Math.ceil(total / Number(limit)),
                    },
                },
                error: null,
            });
        }
        catch (error) {
            console.error("Error fetching medications:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la récupération des médicaments",
            });
        }
    });
}
function getMedicationById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const medication = yield db_1.db.medication.findUnique({
                where: { id },
                include: {
                    supplier: true,
                    hospital: true,
                    prescriptionMedications: true,
                    administrations: true,
                },
            });
            if (!medication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé",
                });
            }
            return res.status(200).json({
                data: medication,
                error: null,
            });
        }
        catch (error) {
            console.error("Error fetching medication:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la récupération du médicament",
            });
        }
    });
}
function updateMedication(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const data = req.body;
            const existingMedication = yield db_1.db.medication.findUnique({
                where: { id },
            });
            if (!existingMedication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé",
                });
            }
            const updateData = {};
            if (data.name !== undefined)
                updateData.name = data.name;
            if (data.form !== undefined)
                updateData.form = data.form;
            if (data.stock !== undefined)
                updateData.stock = data.stock;
            if (data.supplierId !== undefined)
                updateData.supplierId = data.supplierId;
            if (data.hospitalId !== undefined)
                updateData.hospitalId = data.hospitalId;
            const updatedMedication = yield db_1.db.medication.update({
                where: { id },
                data: updateData,
                include: {
                    supplier: true,
                    hospital: true,
                },
            });
            return res.status(200).json({
                data: updatedMedication,
                error: null,
            });
        }
        catch (error) {
            console.error("Error updating medication:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la mise à jour du médicament",
            });
        }
    });
}
function deleteMedication(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const medication = yield db_1.db.medication.findUnique({
                where: { id },
                include: {
                    prescriptionMedications: true,
                    administrations: true,
                },
            });
            if (!medication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé",
                });
            }
            if (medication.prescriptionMedications.length > 0 ||
                medication.administrations.length > 0) {
                return res.status(400).json({
                    data: null,
                    error: "Impossible de supprimer ce médicament car il est utilisé dans des prescriptions ou administrations",
                });
            }
            yield db_1.db.medication.delete({
                where: { id },
            });
            return res.status(200).json({
                data: "Médicament supprimé avec succès",
                error: null,
            });
        }
        catch (error) {
            console.error("Error deleting medication:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la suppression du médicament",
            });
        }
    });
}
function adjustMedicationStock(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { adjustment } = req.body;
            const medication = yield db_1.db.medication.findUnique({
                where: { id },
            });
            if (!medication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé",
                });
            }
            const updatedMedication = yield db_1.db.medication.update({
                where: { id },
                data: {
                    stock: {
                        increment: Number(adjustment) || 0,
                    },
                },
            });
            return res.status(200).json({
                data: updatedMedication,
                error: null,
            });
        }
        catch (error) {
            console.error("Error adjusting medication stock:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de l'ajustement du stock",
            });
        }
    });
}
