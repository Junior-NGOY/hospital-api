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
exports.getLatestGeneralSign = exports.deleteGeneralSign = exports.updateGeneralSign = exports.getGeneralSignById = exports.getConsultationGeneralSigns = exports.getPatientGeneralSigns = exports.createGeneralSign = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createGeneralSign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { patientId, consultationId, consciousness, temperature, respirationRate, bloodPressureSystolic, bloodPressureDiastolic, heartRate, weight, height, bmi, painLevel, mobility, notes, nurseId } = req.body;
        const patient = yield prisma.patient.findUnique({
            where: { id: patientId }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient non trouvé' });
        }
        if (consultationId) {
            const consultation = yield prisma.consultation.findUnique({
                where: { id: consultationId }
            });
            if (!consultation) {
                return res.status(404).json({ error: 'Consultation non trouvée' });
            }
        }
        if (nurseId) {
            const user = yield prisma.user.findUnique({
                where: { id: nurseId }
            });
            if (!user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
        }
        const generalSign = yield prisma.generalSign.create({
            data: {
                patientId,
                consultationId,
                consciousness,
                temperature,
                respirationRate,
                bloodPressureSystolic,
                bloodPressureDiastolic,
                heartRate,
                weight,
                height,
                bmi,
                painLevel,
                mobility,
                notes,
                nurseId
            }
        });
        return res.status(201).json(generalSign);
    }
    catch (error) {
        console.error('Erreur lors de la création du signe général:', error);
        return res.status(500).json({ error: 'Erreur serveur lors de la création du signe général' });
    }
});
exports.createGeneralSign = createGeneralSign;
const getPatientGeneralSigns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { patientId } = req.params;
        const patient = yield prisma.patient.findUnique({
            where: { id: patientId }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient non trouvé' });
        }
        const generalSigns = yield prisma.generalSign.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
            include: {
                nurse: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true
                    }
                }
            }
        });
        return res.status(200).json(generalSigns);
    }
    catch (error) {
        console.error('Erreur lors de la récupération des signes généraux:', error);
        return res.status(500).json({ error: 'Erreur serveur lors de la récupération des signes généraux' });
    }
});
exports.getPatientGeneralSigns = getPatientGeneralSigns;
const getConsultationGeneralSigns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { consultationId } = req.params;
        const consultation = yield prisma.consultation.findUnique({
            where: { id: consultationId }
        });
        if (!consultation) {
            return res.status(404).json({ error: 'Consultation non trouvée' });
        }
        const generalSigns = yield prisma.generalSign.findMany({
            where: { consultationId },
            include: {
                nurse: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true
                    }
                }
            }
        });
        return res.status(200).json(generalSigns);
    }
    catch (error) {
        console.error('Erreur lors de la récupération des signes généraux de la consultation:', error);
        return res.status(500).json({ error: 'Erreur serveur lors de la récupération des signes généraux de la consultation' });
    }
});
exports.getConsultationGeneralSigns = getConsultationGeneralSigns;
const getGeneralSignById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const generalSign = yield prisma.generalSign.findUnique({
            where: { id },
            include: {
                patient: true,
                consultation: true,
                nurse: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true
                    }
                }
            }
        });
        if (!generalSign) {
            return res.status(404).json({ error: 'Signe général non trouvé' });
        }
        return res.status(200).json(generalSign);
    }
    catch (error) {
        console.error('Erreur lors de la récupération du signe général:', error);
        return res.status(500).json({ error: 'Erreur serveur lors de la récupération du signe général' });
    }
});
exports.getGeneralSignById = getGeneralSignById;
const updateGeneralSign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { consciousness, temperature, respirationRate, bloodPressureSystolic, bloodPressureDiastolic, heartRate, weight, height, bmi, painLevel, mobility, notes, nurseId } = req.body;
        const existingGeneralSign = yield prisma.generalSign.findUnique({
            where: { id }
        });
        if (!existingGeneralSign) {
            return res.status(404).json({ error: 'Signe général non trouvé' });
        }
        if (nurseId) {
            const user = yield prisma.user.findUnique({
                where: { id: nurseId }
            });
            if (!user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
        }
        const updatedGeneralSign = yield prisma.generalSign.update({
            where: { id },
            data: {
                consciousness,
                temperature,
                respirationRate,
                bloodPressureSystolic,
                bloodPressureDiastolic,
                heartRate,
                weight,
                height,
                bmi,
                painLevel,
                mobility,
                notes,
                nurseId
            }
        });
        return res.status(200).json(updatedGeneralSign);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour du signe général:', error);
        return res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du signe général' });
    }
});
exports.updateGeneralSign = updateGeneralSign;
const deleteGeneralSign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const generalSign = yield prisma.generalSign.findUnique({
            where: { id }
        });
        if (!generalSign) {
            return res.status(404).json({ error: 'Signe général non trouvé' });
        }
        yield prisma.generalSign.delete({
            where: { id }
        });
        return res.status(200).json({ message: 'Signe général supprimé avec succès' });
    }
    catch (error) {
        console.error('Erreur lors de la suppression du signe général:', error);
        return res.status(500).json({ error: 'Erreur serveur lors de la suppression du signe général' });
    }
});
exports.deleteGeneralSign = deleteGeneralSign;
const getLatestGeneralSign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { patientId } = req.params;
        const patient = yield prisma.patient.findUnique({
            where: { id: patientId }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient non trouvé' });
        }
        const latestGeneralSign = yield prisma.generalSign.findFirst({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
            include: {
                nurse: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true
                    }
                }
            }
        });
        if (!latestGeneralSign) {
            return res.status(404).json({ error: 'Aucun signe général trouvé pour ce patient' });
        }
        return res.status(200).json(latestGeneralSign);
    }
    catch (error) {
        console.error('Erreur lors de la récupération du dernier signe général:', error);
        return res.status(500).json({ error: 'Erreur serveur lors de la récupération du dernier signe général' });
    }
});
exports.getLatestGeneralSign = getLatestGeneralSign;
