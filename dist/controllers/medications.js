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
        try {
            const data = req.body;
            const existingMedication = yield db_1.db.medication.findFirst({
                where: {
                    name: data.name,
                    form: data.form
                }
            });
            if (existingMedication) {
                return res.status(400).json({
                    data: null,
                    error: "Un médicament avec ce nom et cette forme existe déjà"
                });
            }
            if (!data.sellingPrice && data.purchasePrice && data.markupPercentage) {
                data.sellingPrice = data.purchasePrice * (1 + data.markupPercentage / 100);
            }
            const createData = Object.assign({ name: data.name, genericName: data.genericName, form: data.form, strength: data.strength, manufacturer: data.manufacturer, description: data.description, sideEffects: data.sideEffects, contraindications: data.contraindications, stock: data.stock, unitPrice: data.unitPrice, purchasePrice: data.purchasePrice, markupPercentage: data.markupPercentage, sellingPrice: data.sellingPrice, discountable: data.discountable, taxable: data.taxable, taxRate: data.taxRate || 0 }, (data.categoryId && {
                category: {
                    connect: { id: data.categoryId }
                }
            }));
            const newMedication = yield db_1.db.medication.create({
                data: createData,
                include: {
                    supplier: true,
                    hospital: true
                }
            });
            return res.status(201).json({
                data: newMedication,
                error: null
            });
        }
        catch (error) {
            console.error("Error creating medication:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la création du médicament"
            });
        }
    });
}
function getMedications(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { category, search, inStock, sort = "name", order = "asc", page = 1, limit = 10 } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            let where = {};
            if (category) {
                where = Object.assign(Object.assign({}, where), { categoryId: category });
            }
            if (search) {
                where = Object.assign(Object.assign({}, where), { OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { genericName: { contains: search, mode: 'insensitive' } }
                    ] });
            }
            if (inStock === 'true') {
                where = Object.assign(Object.assign({}, where), { stock: { gt: 0 } });
            }
            const medications = yield db_1.db.medication.findMany({
                where,
                include: {
                    supplier: true
                },
                orderBy: { [sort]: order },
                skip,
                take: Number(limit)
            });
            const total = yield db_1.db.medication.count({ where });
            return res.status(200).json({
                data: {
                    medications,
                    pagination: {
                        total,
                        page: Number(page),
                        limit: Number(limit),
                        totalPages: Math.ceil(total / Number(limit))
                    }
                },
                error: null
            });
        }
        catch (error) {
            console.error("Error fetching medications:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la récupération des médicaments"
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
                    prescriptionMedications: {
                        include: {
                            prescription: {
                                include: {
                                    patient: true,
                                    doctor: true
                                }
                            }
                        }
                    }
                }
            });
            if (!medication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé"
                });
            }
            return res.status(200).json({
                data: medication,
                error: null
            });
        }
        catch (error) {
            console.error("Error fetching medication:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la récupération du médicament"
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
                where: { id }
            });
            if (!existingMedication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé"
                });
            }
            if (data.purchasePrice && data.markupPercentage) {
                data.sellingPrice = data.purchasePrice * (1 + data.markupPercentage / 100);
            }
            const updatedMedication = yield db_1.db.medication.update({
                where: { id },
                data,
                include: {
                    supplier: true,
                    hospital: true
                }
            });
            return res.status(200).json({
                data: updatedMedication,
                error: null
            });
        }
        catch (error) {
            console.error("Error updating medication:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la mise à jour du médicament"
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
                    administrations: true
                }
            });
            if (!medication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé"
                });
            }
            if (medication.prescriptionMedications.length > 0 || medication.administrations.length > 0) {
                return res.status(400).json({
                    data: null,
                    error: "Impossible de supprimer ce médicament car il est utilisé dans des prescriptions ou administrations"
                });
            }
            yield db_1.db.medication.delete({
                where: { id }
            });
            return res.status(200).json({
                data: "Médicament supprimé avec succès",
                error: null
            });
        }
        catch (error) {
            console.error("Error deleting medication:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de la suppression du médicament"
            });
        }
    });
}
function adjustMedicationStock(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { adjustment, reason } = req.body;
            const medication = yield db_1.db.medication.findUnique({
                where: { id }
            });
            if (!medication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé"
                });
            }
            const updatedMedication = yield db_1.db.medication.update({
                where: { id },
                data: {
                    stock: {
                        increment: adjustment
                    }
                }
            });
            return res.status(200).json({
                data: updatedMedication,
                error: null
            });
        }
        catch (error) {
            console.error("Error adjusting medication stock:", error);
            return res.status(500).json({
                data: null,
                error: "Erreur lors de l'ajustement du stock"
            });
        }
    });
}
