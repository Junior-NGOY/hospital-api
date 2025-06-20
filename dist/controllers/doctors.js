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
exports.getDoctorConsultations = getDoctorConsultations;
exports.getDoctorAppointments = getDoctorAppointments;
exports.createConsultation = createConsultation;
exports.createPrescription = createPrescription;
exports.requestLabTest = requestLabTest;
const db_1 = require("../db/db");
function getDoctorConsultations(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { doctorId } = req.params;
        const { date, status } = req.query;
        try {
            const doctor = yield db_1.db.doctor.findUnique({
                where: { id: doctorId }
            });
            if (!doctor) {
                return res.status(404).json({
                    data: null,
                    error: "Médecin non trouvé"
                });
            }
            let whereClause = { doctorId };
            if (date) {
                const queryDate = new Date(date);
                whereClause.date = {
                    gte: new Date(queryDate.setHours(0, 0, 0, 0)),
                    lt: new Date(queryDate.setHours(23, 59, 59, 999))
                };
            }
            const consultations = yield db_1.db.consultation.findMany({
                where: whereClause,
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            dateOfBirth: true,
                            gender: true,
                            fileNumber: true
                        }
                    },
                    appointment: true,
                    vitalSigns: {
                        orderBy: {
                            recordedAt: 'desc'
                        },
                        take: 1
                    }
                },
                orderBy: {
                    date: 'desc'
                }
            });
            return res.status(200).json({
                data: consultations,
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
function getDoctorAppointments(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { doctorId } = req.params;
        const { date, status } = req.query;
        try {
            const doctor = yield db_1.db.doctor.findUnique({
                where: { id: doctorId }
            });
            if (!doctor) {
                return res.status(404).json({
                    data: null,
                    error: "Médecin non trouvé"
                });
            }
            let whereClause = { doctorId };
            if (date) {
                const queryDate = new Date(date);
                whereClause.scheduledDate = {
                    gte: new Date(queryDate.setHours(0, 0, 0, 0)),
                    lt: new Date(queryDate.setHours(23, 59, 59, 999))
                };
            }
            if (status) {
                whereClause.status = status;
            }
            const appointments = yield db_1.db.appointment.findMany({
                where: whereClause,
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            dateOfBirth: true,
                            gender: true,
                            fileNumber: true
                        }
                    }
                },
                orderBy: {
                    scheduledDate: 'asc'
                }
            });
            return res.status(200).json({
                data: appointments,
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
function createConsultation(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { doctorId } = req.params;
        const { patientId, appointmentId, chiefComplaint, symptoms, diagnosis, notes, followUpNeeded, followUpDate } = req.body;
        try {
            const doctor = yield db_1.db.doctor.findUnique({
                where: { id: doctorId },
                include: {
                    user: true
                }
            });
            if (!doctor) {
                return res.status(404).json({
                    data: null,
                    error: "Médecin non trouvé"
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
            if (appointmentId) {
                const appointment = yield db_1.db.appointment.findUnique({
                    where: { id: appointmentId }
                });
                if (!appointment) {
                    return res.status(404).json({
                        data: null,
                        error: "Rendez-vous non trouvé"
                    });
                }
                yield db_1.db.appointment.update({
                    where: { id: appointmentId },
                    data: { status: 'COMPLETED' }
                });
            }
            const consultation = yield db_1.db.consultation.create({
                data: {
                    patientId,
                    doctorId,
                    appointmentId,
                    symptoms,
                    diagnosis,
                    notes,
                    followUpNeeded: followUpNeeded || false,
                    followUpDate: followUpDate ? new Date(followUpDate) : undefined,
                    hospitalId: doctor.user.hospitalId,
                    branchId: doctor.user.branchId
                }
            });
            yield db_1.db.patientAccessLog.create({
                data: {
                    patientId,
                    userId: doctor.userId,
                    accessType: 'CREATE',
                    reason: 'Création d\'une consultation'
                }
            });
            return res.status(201).json({
                data: consultation,
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
function createPrescription(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { doctorId } = req.params;
        const { patientId, consultationId, notes, medications } = req.body;
        try {
            const doctor = yield db_1.db.doctor.findUnique({
                where: { id: doctorId },
                include: {
                    user: true
                }
            });
            if (!doctor) {
                return res.status(404).json({
                    data: null,
                    error: "Médecin non trouvé"
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
            if (consultationId) {
                const consultation = yield db_1.db.consultation.findUnique({
                    where: { id: consultationId }
                });
                if (!consultation) {
                    return res.status(404).json({
                        data: null,
                        error: "Consultation non trouvée"
                    });
                }
            }
            const prescription = yield db_1.db.prescription.create({
                data: {
                    patientId,
                    doctorId,
                    consultationId,
                    notes,
                    hospitalId: doctor.user.hospitalId || undefined,
                    medications: {
                        create: medications.map(med => ({
                            medicationId: med.medicationId,
                            dosage: med.dosage,
                            frequency: med.frequency,
                            duration: med.duration,
                            instructions: med.instructions
                        }))
                    }
                },
                include: {
                    medications: {
                        include: {
                            medication: true
                        }
                    }
                }
            });
            yield db_1.db.patientAccessLog.create({
                data: {
                    patientId,
                    userId: doctor.userId,
                    accessType: 'CREATE',
                    reason: 'Création d\'une prescription'
                }
            });
            return res.status(201).json({
                data: prescription,
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
function requestLabTest(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { doctorId } = req.params;
        const { patientId, testName, testType, scheduledAt, notes } = req.body;
        try {
            const doctor = yield db_1.db.doctor.findUnique({
                where: { id: doctorId },
                include: {
                    user: true
                }
            });
            if (!doctor) {
                return res.status(404).json({
                    data: null,
                    error: "Médecin non trouvé"
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
            if (!doctor.user.hospitalId) {
                return res.status(400).json({
                    data: null,
                    error: "L'hôpital du docteur n'est pas défini"
                });
            }
            const labTest = yield db_1.db.labTest.create({
                data: {
                    patientId,
                    doctorId,
                    testName,
                    testType,
                    notes,
                    status: 'PENDING',
                    hospitalId: doctor.user.hospitalId
                }
            });
            return res.status(201).json({
                data: labTest,
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
