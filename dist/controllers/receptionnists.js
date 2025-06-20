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
exports.registerPatient = registerPatient;
exports.scheduleAppointment = scheduleAppointment;
exports.addToQueue = addToQueue;
const db_1 = require("../db/db");
function registerPatient(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = req.body;
        const { userId } = req.params;
        try {
            const user = yield db_1.db.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            if (data.fileNumber) {
                const existingPatient = yield db_1.db.patient.findUnique({
                    where: { fileNumber: data.fileNumber }
                });
                if (existingPatient) {
                    return res.status(409).json({
                        data: null,
                        error: "Un patient avec ce numéro de dossier existe déjà"
                    });
                }
            }
            const fileNumber = data.fileNumber || `P${Date.now().toString().slice(-8)}`;
            const patientData = {
                fileNumber,
                firstName: data.firstName,
                lastName: data.lastName,
                dateOfBirth: new Date(data.dateOfBirth),
                gender: data.gender,
                address: data.address || "",
                phone: data.phone || "",
                email: data.email || "",
                category: data.category || 'PRIVATE'
            };
            if (data.bloodType) {
                patientData.bloodType = data.bloodType;
            }
            if (data.emergencyContact)
                patientData.emergencyContact = data.emergencyContact;
            if (user.hospitalId)
                patientData.hospitalId = user.hospitalId;
            if (user.branchId)
                patientData.branchId = user.branchId;
            const patient = yield db_1.db.patient.create({
                data: patientData
            });
            return res.status(201).json({
                data: patient,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function scheduleAppointment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { userId } = req.params;
        const { patientId, doctorId, scheduledDate, duration, reason, status, notes } = req.body;
        try {
            const user = yield db_1.db.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient non trouvé"
                });
            }
            const doctor = yield db_1.db.doctor.findUnique({
                where: { id: doctorId }
            });
            if (!doctor) {
                return res.status(404).json({
                    data: null,
                    error: "Médecin non trouvé"
                });
            }
            const scheduledDateTime = new Date(scheduledDate);
            const endTime = new Date(scheduledDateTime);
            endTime.setMinutes(endTime.getMinutes() + (duration || 30));
            const conflictingAppointment = yield db_1.db.appointment.findFirst({
                where: {
                    doctorId,
                    scheduledDate: {
                        gte: scheduledDateTime,
                        lt: endTime
                    },
                    status: {
                        notIn: ['CANCELLED', 'COMPLETED']
                    }
                }
            });
            if (conflictingAppointment) {
                return res.status(409).json({
                    data: null,
                    error: "Le médecin a déjà un rendez-vous à cette heure"
                });
            }
            const appointment = yield db_1.db.appointment.create({
                data: {
                    patientId,
                    doctorId,
                    scheduledDate: scheduledDateTime,
                    duration: duration || 30,
                    reason,
                    status: status || 'SCHEDULED',
                    notes,
                    hospitalId: user.hospitalId,
                    branchId: user.branchId
                }
            });
            return res.status(201).json({
                data: appointment,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function addToQueue(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { userId } = req.params;
        const { patientId, queueId, priority, notes } = req.body;
        try {
            const user = yield db_1.db.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient non trouvé"
                });
            }
            const queue = yield db_1.db.queue.findUnique({
                where: { id: queueId }
            });
            if (!queue) {
                return res.status(404).json({
                    data: null,
                    error: "File d'attente non trouvée"
                });
            }
            const existingEntry = yield db_1.db.queueEntry.findFirst({
                where: {
                    patientId,
                    queueId,
                    status: {
                        in: ['WAITING', 'IN_PROGRESS']
                    }
                }
            });
            if (existingEntry) {
                return res.status(409).json({
                    data: null,
                    error: "Le patient est déjà dans cette file d'attente"
                });
            }
            const maxTicket = yield db_1.db.queueEntry.findFirst({
                where: { queueId },
                orderBy: { ticketNumber: 'desc' }
            });
            const ticketNumber = maxTicket ? (maxTicket.ticketNumber || 0) + 1 : 1;
            const queueEntryData = {
                queueId,
                patientId,
                status: 'WAITING',
                priority: priority || 'NORMAL',
                ticketNumber
            };
            if (notes)
                queueEntryData.notes = notes;
            const queueEntry = yield db_1.db.queueEntry.create({
                data: queueEntryData
            });
            return res.status(201).json({
                data: queueEntry,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
