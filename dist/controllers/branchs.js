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
exports.createBranch = createBranch;
exports.getBranchesByHospital = getBranchesByHospital;
exports.getBranchById = getBranchById;
exports.updateBranch = updateBranch;
exports.deleteBranch = deleteBranch;
const db_1 = require("../db/db");
function createBranch(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { hospitalId, name, address, city, state, country, postalCode, phone, email, isMainBranch } = req.body;
        try {
            const hospital = yield db_1.db.hospital.findUnique({
                where: { id: hospitalId }
            });
            if (!hospital) {
                return res.status(404).json({
                    data: null,
                    error: "Hôpital non trouvé"
                });
            }
            if (isMainBranch) {
                yield db_1.db.hospitalBranch.updateMany({
                    where: {
                        hospitalId,
                        isMainBranch: true
                    },
                    data: {
                        isMainBranch: false
                    }
                });
            }
            const newBranch = yield db_1.db.hospitalBranch.create({
                data: {
                    hospitalId,
                    name,
                    address,
                    city,
                    state,
                    country,
                    postalCode,
                    phone,
                    email,
                    isMainBranch: isMainBranch || false
                }
            });
            return res.status(201).json({
                data: newBranch,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la création de la branche"
            });
        }
    });
}
function getBranchesByHospital(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { hospitalId } = req.params;
        try {
            const hospital = yield db_1.db.hospital.findUnique({
                where: { id: hospitalId }
            });
            if (!hospital) {
                return res.status(404).json({
                    data: null,
                    error: "Hôpital non trouvé"
                });
            }
            const branches = yield db_1.db.hospitalBranch.findMany({
                where: { hospitalId },
                orderBy: [
                    { isMainBranch: "desc" },
                    { name: "asc" }
                ],
                include: {
                    _count: {
                        select: {
                            departments: true,
                            users: true
                        }
                    }
                }
            });
            return res.status(200).json({
                data: branches,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des branches"
            });
        }
    });
}
function getBranchById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const branch = yield db_1.db.hospitalBranch.findUnique({
                where: { id },
                include: {
                    hospital: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    },
                    departments: true,
                    _count: {
                        select: {
                            users: true,
                            consultations: true,
                            appointments: true,
                            admissions: true
                        }
                    }
                }
            });
            if (!branch) {
                return res.status(404).json({
                    data: null,
                    error: "Branche non trouvée"
                });
            }
            return res.status(200).json({
                data: branch,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération de la branche"
            });
        }
    });
}
function updateBranch(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { name, address, city, state, country, postalCode, phone, email, isMainBranch } = req.body;
        try {
            const branch = yield db_1.db.hospitalBranch.findUnique({
                where: { id }
            });
            if (!branch) {
                return res.status(404).json({
                    data: null,
                    error: "Branche non trouvée"
                });
            }
            if (isMainBranch) {
                yield db_1.db.hospitalBranch.updateMany({
                    where: {
                        hospitalId: branch.hospitalId,
                        isMainBranch: true,
                        id: { not: id }
                    },
                    data: {
                        isMainBranch: false
                    }
                });
            }
            const updatedBranch = yield db_1.db.hospitalBranch.update({
                where: { id },
                data: {
                    name: name || undefined,
                    address: address || undefined,
                    city: city || undefined,
                    state: state || undefined,
                    country: country || undefined,
                    postalCode: postalCode || undefined,
                    phone: phone || undefined,
                    email: email || undefined,
                    isMainBranch: isMainBranch !== undefined ? isMainBranch : undefined
                }
            });
            return res.status(200).json({
                data: updatedBranch,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la mise à jour de la branche"
            });
        }
    });
}
function deleteBranch(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const branch = yield db_1.db.hospitalBranch.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            departments: true,
                            users: true,
                            consultations: true,
                            appointments: true,
                            admissions: true
                        }
                    }
                }
            });
            if (!branch) {
                return res.status(404).json({
                    data: null,
                    error: "Branche non trouvée"
                });
            }
            if (branch._count.departments > 0 ||
                branch._count.users > 0 ||
                branch._count.consultations > 0 ||
                branch._count.appointments > 0 ||
                branch._count.admissions > 0) {
                return res.status(400).json({
                    data: null,
                    error: "Impossible de supprimer cette branche car elle contient des départements, des utilisateurs ou des données médicales"
                });
            }
            yield db_1.db.hospitalBranch.delete({
                where: { id }
            });
            return res.status(200).json({
                data: { id },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la suppression de la branche"
            });
        }
    });
}
