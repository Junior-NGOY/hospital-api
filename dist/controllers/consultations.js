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
exports.createConsultation = createConsultation;
exports.getConsultations = getConsultations;
exports.getConsultationById = getConsultationById;
exports.updateConsultation = updateConsultation;
exports.deleteConsultation = deleteConsultation;
exports.getPatientConsultationHistory = getPatientConsultationHistory;
exports.getDoctorConsultations = getDoctorConsultations;
exports.markConsultationAsPaid = markConsultationAsPaid;
exports.addClinicalExamination = addClinicalExamination;
exports.addParaclinicalExam = addParaclinicalExam;
const db_1 = require("../db/db");
function createConsultation(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = req.body;
        const patientId = data.selectedPatient.id;
        const doctorId = data.doctorId;
        const chiefComplaintId = data.currentIllness.chiefComplaint;
        const { appointmentId, hospitalId, branchId, diagnosis, notes, followUpNeeded, followUpDate, consultationFee, basePrice, appliedPrice, discountAmount, subscriptionId } = data;
        try {
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient non trouvé"
                });
            }
            const newConsultation = yield db_1.db.consultation.create({
                data: {
                    patientId,
                    doctorId: doctorId,
                    appointmentId,
                    hospitalId,
                    branchId,
                    chiefComplaintId,
                    diagnosis: diagnosis ? (typeof diagnosis === 'object' ? JSON.parse(JSON.stringify(diagnosis)) : diagnosis) : undefined,
                    notes,
                    followUpNeeded: followUpNeeded || false,
                    followUpDate: followUpDate ? new Date(followUpDate) : undefined,
                    consultationFee,
                    basePrice,
                    appliedPrice,
                    discountAmount,
                    subscriptionId
                },
            });
            if (data.vitalSigns) {
                let validNurseId = null;
                if (data.vitalSigns.staffId) {
                    const nurse = yield db_1.db.nurse.findUnique({
                        where: { id: data.vitalSigns.staffId }
                    });
                    if (nurse) {
                        validNurseId = nurse.id;
                    }
                }
                yield db_1.db.vitalSign.create({
                    data: {
                        patientId,
                        nurseId: validNurseId,
                        consultationId: newConsultation.id,
                        temperature: parseFloat(data.vitalSigns.temperature),
                        respirationRate: parseFloat(data.vitalSigns.respirationRate),
                        height: parseFloat(data.vitalSigns.height),
                        weight: parseFloat(data.vitalSigns.weight),
                        pa: parseFloat(data.vitalSigns.pa),
                        ta: data.vitalSigns.ta,
                        ddr: data.vitalSigns.ddr,
                        dpa: data.vitalSigns.dpa,
                        pc: parseFloat(data.vitalSigns.pc),
                        imc: parseFloat(data.vitalSigns.imc),
                        pas: parseFloat(data.vitalSigns.pas),
                        pad: parseFloat(data.vitalSigns.pad),
                        fc: parseFloat(data.vitalSigns.fc),
                        spo2: parseFloat(data.vitalSigns.spo2),
                        notes: data.vitalSigns.notes,
                        recordedAt: data.vitalSigns.recordedAt ? new Date(data.vitalSigns.recordedAt) : new Date()
                    }
                });
            }
            return res.status(201).json({
                data: newConsultation,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la création de la consultation"
            });
        }
    });
}
function getConsultations(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { patientId, doctorId, hospitalId, branchId, startDate, endDate, isPaid, page = "1", limit = "20" } = req.query;
        try {
            const where = {};
            if (patientId) {
                where.patientId = patientId;
            }
            if (doctorId) {
                where.doctorId = doctorId;
            }
            if (hospitalId) {
                where.hospitalId = hospitalId;
            }
            if (branchId) {
                where.branchId = branchId;
            }
            if (startDate && endDate) {
                where.date = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            else if (startDate) {
                where.date = {
                    gte: new Date(startDate)
                };
            }
            else if (endDate) {
                where.date = {
                    lte: new Date(endDate)
                };
            }
            if (isPaid !== undefined) {
                where.isPaid = isPaid === "true";
            }
            const pageNumber = parseInt(page) || 1;
            const limitNumber = parseInt(limit) || 20;
            const skip = (pageNumber - 1) * limitNumber;
            const [consultations, total] = yield Promise.all([
                db_1.db.consultation.findMany({
                    where,
                    orderBy: { date: "desc" },
                    skip,
                    take: limitNumber,
                    include: {
                        patient: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                fileNumber: true
                            }
                        },
                        doctor: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true
                                    }
                                }
                            }
                        },
                        appointment: {
                            select: {
                                id: true,
                                scheduledDate: true,
                                status: true
                            }
                        },
                        hospital: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        branch: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        _count: {
                            select: {
                                prescriptions: true,
                                vitalSigns: true
                            }
                        }
                    }
                }),
                db_1.db.consultation.count({ where })
            ]);
            const totalPages = Math.ceil(total / limitNumber);
            const hasNextPage = pageNumber < totalPages;
            const hasPrevPage = pageNumber > 1;
            return res.status(200).json({
                data: {
                    consultations,
                    pagination: {
                        total,
                        page: pageNumber,
                        limit: limitNumber,
                        totalPages,
                        hasNextPage,
                        hasPrevPage
                    }
                },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des consultations"
            });
        }
    });
}
function getConsultationById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const consultation = yield db_1.db.consultation.findUnique({
                where: { id },
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            fileNumber: true,
                            dateOfBirth: true,
                            gender: true,
                            bloodType: true,
                            allergies: true
                        }
                    },
                    doctor: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            }
                        }
                    },
                    appointment: true,
                    hospital: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    branch: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    prescriptions: {
                        include: {
                            medications: {
                                include: {
                                    medication: true
                                }
                            }
                        }
                    },
                    vitalSigns: true,
                    clinicalExamination: true,
                    paraclinicalExam: true,
                }
            });
            if (!consultation) {
                return res.status(404).json({
                    data: null,
                    error: "Consultation non trouvée"
                });
            }
            return res.status(200).json({
                data: consultation,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération de la consultation"
            });
        }
    });
}
function updateConsultation(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { chiefComplaint, symptoms, diagnosis, notes, followUpNeeded, followUpDate, consultationFee, isPaid, basePrice, appliedPrice, discountAmount } = req.body;
        try {
            const consultation = yield db_1.db.consultation.findUnique({
                where: { id }
            });
            if (!consultation) {
                return res.status(404).json({
                    data: null,
                    error: "Consultation non trouvée"
                });
            }
            const updatedConsultation = yield db_1.db.consultation.update({
                where: { id },
                data: {
                    chiefComplaintId: chiefComplaint || undefined,
                    diagnosis: diagnosis !== undefined ? diagnosis : undefined,
                    notes: notes !== undefined ? notes : undefined,
                    followUpNeeded: followUpNeeded !== undefined ? followUpNeeded : undefined,
                    followUpDate: followUpDate ? new Date(followUpDate) : undefined,
                    consultationFee: consultationFee !== undefined ? consultationFee : undefined,
                    basePrice: basePrice !== undefined ? basePrice : undefined,
                    appliedPrice: appliedPrice !== undefined ? appliedPrice : undefined,
                    discountAmount: discountAmount !== undefined ? discountAmount : undefined
                },
                include: {
                    patient: {
                        select: {
                            firstName: true,
                            lastName: true,
                            fileNumber: true
                        }
                    },
                    doctor: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    }
                }
            });
            return res.status(200).json({
                data: updatedConsultation,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la mise à jour de la consultation"
            });
        }
    });
}
function deleteConsultation(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const [consultation, prescriptionsCount, labTestsCount, vitalSignsCount, clinicalExaminationCount] = yield Promise.all([
                db_1.db.consultation.findUnique({
                    where: { id }
                }),
                db_1.db.prescription.count({
                    where: { consultationId: id }
                }),
                db_1.db.vitalSign.count({
                    where: { consultationId: id }
                }),
                db_1.db.clinicalExamination.count({
                    where: { consultationId: id }
                }),
                db_1.db.paraclinicalExam.count({
                    where: { consultationId: id }
                })
            ]);
            if (!consultation) {
                return res.status(404).json({
                    data: null,
                    error: "Consultation non trouvée"
                });
            }
            const hasRelatedEntities = prescriptionsCount > 0 ||
                labTestsCount > 0 ||
                vitalSignsCount > 0 ||
                clinicalExaminationCount > 0 ||
                (yield db_1.db.consultation.delete({
                    where: { id }
                }));
            return res.status(200).json({
                data: { id },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la suppression de la consultation"
            });
        }
    });
}
function getPatientConsultationHistory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { patientId } = req.params;
        const { limit = "10" } = req.query;
        try {
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient non trouvé"
                });
            }
            const consultations = yield db_1.db.consultation.findMany({
                where: { patientId },
                orderBy: { date: "desc" },
                take: parseInt(limit) || 10,
                include: {
                    doctor: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    hospital: {
                        select: {
                            name: true
                        }
                    },
                    branch: {
                        select: {
                            name: true
                        }
                    },
                    _count: {
                        select: {
                            prescriptions: true,
                        }
                    }
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
                error: "Une erreur est survenue lors de la récupération de l'historique des consultations"
            });
        }
    });
}
function getDoctorConsultations(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { doctorId } = req.params;
        const { startDate, endDate } = req.query;
        try {
            const doctor = yield db_1.db.doctor.findUnique({
                where: { id: doctorId },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });
            if (!doctor) {
                return res.status(404).json({
                    data: null,
                    error: "Médecin non trouvé"
                });
            }
            const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
            const end = endDate ? new Date(endDate) : new Date(new Date().setHours(23, 59, 59, 999));
            const consultations = yield db_1.db.consultation.findMany({
                where: {
                    doctorId,
                    date: {
                        gte: start,
                        lte: end
                    }
                },
                orderBy: { date: "asc" },
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            fileNumber: true
                        }
                    },
                    appointment: {
                        select: {
                            scheduledDate: true
                        }
                    }
                }
            });
            const totalConsultations = consultations.length;
            const followUps = consultations.filter(c => c.followUpNeeded).length;
            const withPrescriptions = yield db_1.db.prescription.count({
                where: {
                    doctorId,
                    consultationId: {
                        in: consultations.map(c => c.id)
                    }
                }
            });
            return res.status(200).json({
                data: {
                    doctor: {
                        id: doctor.id,
                        name: `${doctor.user.firstName} ${doctor.user.lastName}`
                    },
                    period: {
                        start,
                        end
                    },
                    stats: {
                        totalConsultations,
                        followUps,
                        withPrescriptions,
                    },
                    consultations
                },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des consultations du médecin"
            });
        }
    });
}
function markConsultationAsPaid(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { paymentMethod, paymentAmount, createInvoice = true, accountantId } = req.body;
        try {
            const consultation = yield db_1.db.consultation.findUnique({
                where: { id }
            });
            if (!consultation) {
                return res.status(404).json({
                    data: null,
                    error: "Consultation non trouvée"
                });
            }
            const [patient, doctor,] = yield Promise.all([
                db_1.db.patient.findUnique({
                    where: { id: consultation.patientId }
                }),
                consultation.doctorId ? db_1.db.doctor.findUnique({
                    where: { id: consultation.doctorId },
                    include: {
                        user: true
                    }
                }) : null,
            ]);
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient non trouvé"
                });
            }
            const isPaid = (yield db_1.db.invoice.findFirst({
                where: {
                    status: "PAID"
                }
            })) !== null;
            if (isPaid) {
                return res.status(400).json({
                    data: null,
                    error: "Cette consultation est déjà marquée comme payée"
                });
            }
            const amountToPay = consultation.appliedPrice || consultation.consultationFee || 0;
            if (amountToPay <= 0) {
                return res.status(400).json({
                    data: null,
                    error: "Le montant de la consultation n'est pas défini"
                });
            }
            if (paymentAmount < amountToPay) {
                return res.status(400).json({
                    data: null,
                    error: "Le montant payé est inférieur au montant de la consultation"
                });
            }
            return res.status(200).json({
                data: {
                    consultationId: id,
                    isPaid: true,
                    paymentAmount,
                    paymentMethod,
                },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors du paiement de la consultation"
            });
        }
    });
}
function addClinicalExamination(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { consultationId } = req.params;
        const { generalAppearance, vitalSigns, heent, cardiovascular, respiratory, gastrointestinal, musculoskeletal, neurological, skin, findings, conclusion } = req.body;
        try {
            const consultation = yield db_1.db.consultation.findUnique({
                where: { id: consultationId },
                include: {
                    doctor: true,
                    patient: true
                }
            });
            if (!consultation) {
                return res.status(404).json({
                    data: null,
                    error: "Consultation non trouvée"
                });
            }
            const clinicalExamination = yield db_1.db.clinicalExamination.create({
                data: {
                    patientId: consultation.patientId,
                    doctorId: consultation.doctorId,
                    consultationId,
                    findings: findings ? JSON.parse(findings) : undefined,
                }
            });
            return res.status(201).json({
                data: clinicalExamination,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de l'ajout de l'examen clinique"
            });
        }
    });
}
function addParaclinicalExam(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { consultationId } = req.params;
        const { examType, priority, requestReason, clinicalContext, instructions, scheduledAt } = req.body;
        try {
            const consultation = yield db_1.db.consultation.findUnique({
                where: { id: consultationId },
                include: {
                    doctor: true,
                    patient: true
                }
            });
            if (!consultation) {
                return res.status(404).json({
                    data: null,
                    error: "Consultation non trouvée"
                });
            }
            const paraclinicalExam = yield db_1.db.paraclinicalExam.create({
                data: {
                    patientId: consultation.patientId,
                    doctorId: consultation.doctorId,
                    consultationId,
                    examType,
                    priority: priority || "ROUTINE",
                    requestReason,
                    clinicalContext,
                    instructions,
                    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
                }
            });
            return res.status(201).json({
                data: paraclinicalExam,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de l'ajout de l'examen paraclinique"
            });
        }
    });
}
