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
exports.createHospital = createHospital;
exports.getHospitals = getHospitals;
exports.getHospitalById = getHospitalById;
exports.updateHospital = updateHospital;
exports.deleteHospital = deleteHospital;
const db_1 = require("../db/db");
const generateSlug_1 = require("../utils/generateSlug");
function createHospital(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, address, phoneNumber, email } = req.body;
        try {
            const slug = (0, generateSlug_1.generateSlug)(name);
            const existingHospital = yield db_1.db.hospital.findUnique({
                where: {
                    slug
                }
            });
            if (existingHospital) {
                return res.status(409).json({
                    data: null,
                    error: "Un hôpital avec ce nom existe déjà"
                });
            }
            const newHospital = yield db_1.db.hospital.create({
                data: {
                    name,
                    slug,
                    address,
                    phoneNumber,
                    email
                }
            });
            console.log(`Hôpital créé avec succès: ${newHospital.name} (${newHospital.id})`);
            return res.status(201).json({
                data: newHospital,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la création de l'hôpital"
            });
        }
    });
}
function getHospitals(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const hospitals = yield db_1.db.hospital.findMany({
                orderBy: {
                    createdAt: "desc"
                },
                include: {
                    departments: true,
                    branches: true,
                    _count: {
                        select: {
                            users: true,
                            departments: true
                        }
                    }
                }
            });
            return res.status(200).json({
                data: hospitals,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des hôpitaux"
            });
        }
    });
}
function getHospitalById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const hospital = yield db_1.db.hospital.findUnique({
                where: {
                    id
                },
                include: {
                    departments: true,
                    branches: true,
                    settings: true,
                    _count: {
                        select: {
                            users: true
                        }
                    }
                }
            });
            if (!hospital) {
                return res.status(404).json({
                    data: null,
                    error: "Hôpital non trouvé"
                });
            }
            return res.status(200).json({
                data: hospital,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération de l'hôpital"
            });
        }
    });
}
function updateHospital(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { name, address, phoneNumber, email } = req.body;
        try {
            const existingHospital = yield db_1.db.hospital.findUnique({
                where: {
                    id
                }
            });
            if (!existingHospital) {
                return res.status(404).json({
                    data: null,
                    error: "Hôpital non trouvé"
                });
            }
            let slug = existingHospital.slug;
            if (name && name !== existingHospital.name) {
                slug = (0, generateSlug_1.generateSlug)(name);
                const hospitalWithSlug = yield db_1.db.hospital.findFirst({
                    where: {
                        slug,
                        id: {
                            not: id
                        }
                    }
                });
                if (hospitalWithSlug) {
                    return res.status(409).json({
                        data: null,
                        error: "Un hôpital avec ce nom existe déjà"
                    });
                }
            }
            const updatedHospital = yield db_1.db.hospital.update({
                where: {
                    id
                },
                data: {
                    name: name || undefined,
                    slug: slug || undefined,
                    address: address || undefined,
                    phoneNumber: phoneNumber || undefined,
                    email: email || undefined
                }
            });
            return res.status(200).json({
                data: updatedHospital,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la mise à jour de l'hôpital"
            });
        }
    });
}
function deleteHospital(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const existingHospital = yield db_1.db.hospital.findUnique({
                where: {
                    id
                }
            });
            if (!existingHospital) {
                return res.status(404).json({
                    data: null,
                    error: "Hôpital non trouvé"
                });
            }
            yield db_1.db.hospital.delete({
                where: {
                    id
                }
            });
            return res.status(200).json({
                data: null,
                error: null,
                message: "Hôpital supprimé avec succès"
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la suppression de l'hôpital"
            });
        }
    });
}
