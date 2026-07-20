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
exports.getNextPatientSequence = getNextPatientSequence;
exports.createPatient = createPatient;
exports.getPatientById = getPatientById;
exports.updatePatient = updatePatient;
exports.searchPatients = searchPatients;
exports.deletePatient = deletePatient;
exports.getPatientMedicalHistory = getPatientMedicalHistory;
exports.addPatientToQueue = addPatientToQueue;
exports.addPatientAllergy = addPatientAllergy;
exports.addMedicalHistory = addMedicalHistory;
exports.getRecentPatients = getRecentPatients;
exports.getPatients = getPatients;
const db_1 = require("../db/db");
const calculateAge_1 = require("../utils/calculateAge");
const convertDateToIso_1 = require("../utils/convertDateToIso");
function getNextPatientSequence(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const lastPatient = yield db_1.db.patient.findFirst({
                orderBy: {
                    createdAt: "desc"
                }
            });
            const stringSeq = (_a = lastPatient === null || lastPatient === void 0 ? void 0 : lastPatient.fileNumber) === null || _a === void 0 ? void 0 : _a.split("/")[3];
            const lastSeq = stringSeq ? parseInt(stringSeq) : 0;
            const nextSeq = lastSeq + 1;
            return res.status(200).json(nextSeq);
        }
        catch (error) {
            console.log(error);
        }
    });
}
function createPatient(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const data = req.body;
        const body = data;
        try {
            const fileNumber = body.fileNumber || body.regNo || `HOPE/IND/${new Date().getFullYear()}/0001`;
            const phone = body.phone || body.phoneNumber || null;
            const maritalStatus = body.maritalStatus ||
                body.maritalStatut ||
                undefined;
            const firstName = body.firstName || ((_a = body.name) === null || _a === void 0 ? void 0 : _a.split(" ")[0]) || "Patient";
            const lastName = body.lastName || ((_b = body.name) === null || _b === void 0 ? void 0 : _b.split(" ").slice(1).join(" ")) || firstName;
            const name = body.name || `${firstName} ${lastName}`.trim();
            const rawCategory = body.category || "PRIVATE";
            const category = rawCategory === "INDIVIDUAL" || rawCategory === "IND"
                ? "PRIVATE"
                : rawCategory === "SUS" || rawCategory === "SUBSCRIBER"
                    ? "SUBSCRIBER"
                    : rawCategory === "PRIVATE" || rawCategory === "SUBSCRIBER"
                        ? rawCategory
                        : "PRIVATE";
            const existingPatient = yield db_1.db.patient.findUnique({
                where: { fileNumber },
            });
            if (existingPatient) {
                return res.status(409).json({
                    data: null,
                    error: "Un patient avec ce numéro de dossier existe déjà",
                });
            }
            const patient = yield db_1.db.patient.create({
                data: {
                    fileNumber,
                    title: body.title,
                    name,
                    firstName,
                    lastName,
                    dateOfBirth: new Date(body.dateOfBirth),
                    gender: body.gender,
                    address: body.address,
                    admissionDate: body.admissionDate
                        ? (() => {
                            try {
                                return (0, convertDateToIso_1.convertDateToIso)(String(body.admissionDate).slice(0, 10));
                            }
                            catch (_a) {
                                return new Date(body.admissionDate);
                            }
                        })()
                        : new Date(),
                    maritalStatus,
                    nationality: body.nationality,
                    profession: body.profession,
                    phone,
                    email: body.email,
                    bloodType: body.bloodType,
                    emergencyContact: body.emergencyContact,
                    category,
                },
            });
            return res.status(201).json({
                data: patient,
                error: null,
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong",
            });
        }
    });
}
function getPatientById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const patientId = (req.params.id || req.params.patientId);
        try {
            let patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                patient = yield db_1.db.patient.findUnique({
                    where: { fileNumber: patientId }
                });
            }
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient not found"
                });
            }
            const resolvedPatientId = patient.id;
            const recentQueueEntries = yield db_1.db.queueEntry.findMany({
                where: { patientId: resolvedPatientId },
                include: {
                    queue: true,
                },
                take: 5
            });
            const recentConsultations = yield db_1.db.consultation.findMany({
                where: { patientId: resolvedPatientId },
                include: {
                    doctor: {
                        include: {
                            user: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            });
            const allergies = yield db_1.db.patientAllergy.findMany({
                where: { patientId: resolvedPatientId },
            });
            const medicalHistories = yield db_1.db.medicalHistory.findMany({
                where: { patientId: resolvedPatientId },
            });
            const age = (0, calculateAge_1.calculateAge)(patient.dateOfBirth);
            const responseData = Object.assign(Object.assign({}, patient), { age, recentQueueEntries: recentQueueEntries.map(entry => {
                    var _a;
                    return ({
                        id: entry.id,
                        queueId: entry.queueId,
                        queueName: ((_a = entry.queue) === null || _a === void 0 ? void 0 : _a.name) || 'Queue inconnue',
                        status: entry.status,
                        priority: entry.priority,
                        createdAt: entry.createdAt
                    });
                }), recentConsultations: recentConsultations.map(consultation => ({
                    id: consultation.id,
                    date: consultation.date,
                    reason: "consultation.chiefComplaint",
                    diagnosis: consultation.diagnosis,
                    doctor: consultation.doctor ? {
                        id: consultation.doctor.id,
                        name: `${consultation.doctor.user.firstName} ${consultation.doctor.user.lastName}`
                    } : null
                })), allergies: allergies.map(item => ({
                    id: item.id,
                    severity: item.severity,
                    reaction: item.reaction,
                    notes: item.notes
                })), medicalHistories: medicalHistories.map(history => ({
                    id: history.id,
                    condition: history.condition,
                    date: history.createdAt,
                    notes: history.notes
                })) });
            return res.status(200).json({
                data: responseData,
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
function updatePatient(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const patientId = (req.params.id || req.params.patientId);
        const data = req.body;
        try {
            const existingPatient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!existingPatient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient not found"
                });
            }
            const fileNumber = data.fileNumber || data.regNo;
            const phone = data.phone !== undefined ? data.phone : data.phoneNumber;
            if (fileNumber && fileNumber !== existingPatient.fileNumber) {
                const patientWithFileNumber = yield db_1.db.patient.findUnique({
                    where: { fileNumber }
                });
                if (patientWithFileNumber && patientWithFileNumber.id !== patientId) {
                    return res.status(409).json({
                        data: null,
                        error: "Un autre patient utilise déjà ce numéro de dossier"
                    });
                }
            }
            const updateData = {};
            if (fileNumber !== undefined)
                updateData.fileNumber = fileNumber;
            if (data.title !== undefined)
                updateData.title = data.title;
            if (data.name !== undefined)
                updateData.name = data.name;
            if (data.firstName !== undefined)
                updateData.firstName = data.firstName;
            if (data.lastName !== undefined)
                updateData.lastName = data.lastName;
            if (data.dateOfBirth !== undefined)
                updateData.dateOfBirth = new Date(data.dateOfBirth);
            if (data.gender !== undefined)
                updateData.gender = data.gender;
            if (data.address !== undefined)
                updateData.address = data.address;
            if (phone !== undefined)
                updateData.phone = phone;
            if (data.email !== undefined)
                updateData.email = data.email;
            if (data.bloodType !== undefined)
                updateData.bloodType = data.bloodType;
            if (data.emergencyContact !== undefined)
                updateData.emergencyContact = data.emergencyContact;
            if (data.category !== undefined) {
                const raw = data.category;
                updateData.category =
                    raw === "INDIVIDUAL" || raw === "IND" ? "PRIVATE" : raw;
            }
            if (data.nationality !== undefined)
                updateData.nationality = data.nationality;
            if (data.profession !== undefined)
                updateData.profession = data.profession;
            if (data.maritalStatus !== undefined)
                updateData.maritalStatus = data.maritalStatus;
            if (data.admissionDate !== undefined) {
                try {
                    updateData.admissionDate = (0, convertDateToIso_1.convertDateToIso)(String(data.admissionDate).slice(0, 10));
                }
                catch (_a) {
                    updateData.admissionDate = new Date(data.admissionDate);
                }
            }
            const updatedPatient = yield db_1.db.patient.update({
                where: { id: patientId },
                data: updateData
            });
            const age = (0, calculateAge_1.calculateAge)(updatedPatient.dateOfBirth);
            return res.status(200).json({
                data: Object.assign(Object.assign({}, updatedPatient), { age }),
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
function searchPatients(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { query, fileNumber, gender, minAge, maxAge, category, bloodType, page = '1', limit = '10' } = req.query;
        try {
            const pageNumber = parseInt(page, 10);
            const limitNumber = parseInt(limit, 10);
            const skip = (pageNumber - 1) * limitNumber;
            const where = {};
            if (fileNumber) {
                where.fileNumber = { contains: fileNumber };
            }
            if (query) {
                where.OR = [
                    { firstName: { contains: query, mode: 'insensitive' } },
                    { lastName: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                    { phone: { contains: query } },
                    { address: { contains: query, mode: 'insensitive' } }
                ];
            }
            if (gender) {
                where.gender = gender;
            }
            if (category) {
                where.category = category;
            }
            if (bloodType) {
                where.bloodType = bloodType;
            }
            if (minAge || maxAge) {
                const today = new Date();
                if (minAge) {
                    const minBirthYear = today.getFullYear() - parseInt(minAge, 10);
                    where.dateOfBirth = Object.assign(Object.assign({}, (where.dateOfBirth || {})), { lte: new Date(minBirthYear, today.getMonth(), today.getDate()) });
                }
                if (maxAge) {
                    const maxBirthYear = today.getFullYear() - parseInt(maxAge, 10);
                    where.dateOfBirth = Object.assign(Object.assign({}, (where.dateOfBirth || {})), { gte: new Date(maxBirthYear, today.getMonth(), today.getDate()) });
                }
            }
            const totalCount = yield db_1.db.patient.count({ where });
            const patients = yield db_1.db.patient.findMany({
                where,
                orderBy: [
                    { lastName: 'asc' },
                    { firstName: 'asc' }
                ],
                skip,
                take: limitNumber
            });
            const patientsWithAge = patients.map(patient => (Object.assign(Object.assign({}, patient), { age: (0, calculateAge_1.calculateAge)(patient.dateOfBirth) })));
            const totalPages = Math.ceil(totalCount / limitNumber);
            return res.status(200).json({
                data: {
                    patients: patientsWithAge,
                    pagination: {
                        total: totalCount,
                        page: pageNumber,
                        limit: limitNumber,
                        totalPages
                    }
                },
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
function deletePatient(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const patientId = (req.params.id || req.params.patientId);
        try {
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient not found"
                });
            }
            const queueEntries = yield db_1.db.queueEntry.findMany({
                where: { patientId }
            });
            if (queueEntries.length > 0) {
                return res.status(409).json({
                    data: null,
                    error: "Ce patient ne peut pas être supprimé car il a des entrées dans les files d'attente"
                });
            }
            yield db_1.db.patient.delete({
                where: { id: patientId }
            });
            return res.status(200).json({
                data: {
                    message: "Patient supprimé avec succès",
                    id: patientId
                },
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
function getPatientMedicalHistory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { patientId } = req.params;
        try {
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient not found"
                });
            }
            const consultations = yield db_1.db.consultation.findMany({
                where: { patientId },
                include: {
                    doctor: {
                        include: {
                            user: true
                        }
                    },
                    hospital: true,
                    branch: true
                },
                orderBy: { createdAt: 'desc' }
            });
            const prescriptions = yield db_1.db.prescription.findMany({
                where: { patientId },
                include: {
                    doctor: {
                        include: {
                            user: true
                        }
                    },
                    medications: {
                        include: {
                            medication: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            const vitalSigns = yield db_1.db.vitalSign.findMany({
                where: { patientId },
                orderBy: { recordedAt: 'desc' }
            });
            const allergies = yield db_1.db.patientAllergy.findMany({
                where: { patientId }
            });
            const medicalHistories = yield db_1.db.medicalHistory.findMany({
                where: { patientId },
                orderBy: { createdAt: 'desc' }
            });
            const vaccinations = yield db_1.db.vaccination.findMany({
                where: { patientId },
                orderBy: { createdAt: 'desc' }
            });
            const surgeries = yield db_1.db.surgery.findMany({
                where: { patientId },
                include: {
                    primarySurgeon: {
                        include: {
                            user: true
                        }
                    },
                    hospital: true,
                    branch: true
                },
                orderBy: { createdAt: 'desc' }
            });
            const responseData = {
                patient: {
                    id: patient.id,
                    fileNumber: patient.fileNumber,
                    firstName: patient.firstName,
                    lastName: patient.lastName,
                    fullName: `${patient.firstName} ${patient.lastName}`,
                    dateOfBirth: patient.dateOfBirth,
                    age: (0, calculateAge_1.calculateAge)(patient.dateOfBirth),
                    gender: patient.gender,
                    bloodType: patient.bloodType,
                    category: patient.category
                },
                consultations: consultations.map(consultation => ({
                    id: consultation.id,
                    date: consultation.date,
                    createdAt: consultation.createdAt,
                    chiefComplaint: "consultation.chiefComplaint",
                    symptoms: consultation.symptoms,
                    diagnosis: consultation.diagnosis,
                    notes: consultation.notes,
                    followUpNeeded: consultation.followUpNeeded,
                    followUpDate: consultation.followUpDate,
                    doctor: consultation.doctor ? {
                        id: consultation.doctor.id,
                        name: `${consultation.doctor.user.firstName} ${consultation.doctor.user.lastName}`
                    } : null,
                    hospital: consultation.hospital ? {
                        id: consultation.hospital.id,
                        name: consultation.hospital.name
                    } : null,
                    branch: consultation.branch ? {
                        id: consultation.branch.id,
                        name: consultation.branch.name
                    } : null
                })),
                prescriptions: prescriptions.map(prescription => ({
                    id: prescription.id,
                    createdAt: prescription.createdAt,
                    doctor: prescription.doctor ? {
                        id: prescription.doctor.id,
                        name: `${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}`
                    } : null,
                    medications: prescription.medications.map(med => ({
                        id: med.id,
                        name: med.medication ? med.medication.name : "Médicament inconnu",
                        dosage: med.dosage,
                        frequency: med.frequency,
                        duration: med.duration,
                        instructions: med.instructions
                    }))
                })),
                vitalSigns: vitalSigns.map(vs => ({
                    id: vs.id,
                    recordedAt: vs.recordedAt,
                    temperature: vs.temperature,
                    heartRate: vs.fc,
                    bloodPressureSystolic: vs.pas,
                    bloodPressureDiastolic: vs.pad,
                    respirationRate: vs.respirationRate,
                    weight: vs.weight,
                    height: vs.height
                })),
                allergies: allergies.map(allergy => ({
                    id: allergy.id,
                    severity: allergy.severity,
                    reaction: allergy.reaction,
                    notes: allergy.notes
                })),
                medicalHistories: medicalHistories.map(history => ({
                    id: history.id,
                    condition: history.condition,
                    createdAt: history.createdAt,
                    notes: history.notes
                })),
                vaccinations: vaccinations.map(vaccination => ({
                    id: vaccination.id,
                    vaccine: vaccination.vaccine,
                    createdAt: vaccination.createdAt,
                    doseNumber: vaccination.doseNumber,
                })),
                surgeries: surgeries.map(surgery => ({
                    id: surgery.id,
                    surgeryType: surgery.surgeryType,
                    scheduledStart: surgery.scheduledStart,
                    actualStart: surgery.actualStart,
                    actualEnd: surgery.actualEnd,
                    status: surgery.status,
                    preOpDiagnosis: surgery.preOpDiagnosis,
                    postOpDiagnosis: surgery.postOpDiagnosis,
                    complications: surgery.complications,
                    notes: surgery.notes,
                    createdAt: surgery.createdAt,
                    primarySurgeon: surgery.primarySurgeon ? {
                        id: surgery.primarySurgeon.id,
                        name: `${surgery.primarySurgeon.user.firstName} ${surgery.primarySurgeon.user.lastName}`
                    } : null,
                    hospital: surgery.hospital ? {
                        id: surgery.hospital.id,
                        name: surgery.hospital.name
                    } : null,
                    branch: surgery.branch ? {
                        id: surgery.branch.id,
                        name: surgery.branch.name
                    } : null
                }))
            };
            return res.status(200).json({
                data: responseData,
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
function addPatientToQueue(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { patientId } = req.params;
        const { queueId, priority, notes } = req.body;
        try {
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient not found"
                });
            }
            const queue = yield db_1.db.queue.findUnique({
                where: { id: queueId }
            });
            if (!queue) {
                return res.status(404).json({
                    data: null,
                    error: "Queue not found"
                });
            }
            if (!queue.isActive) {
                return res.status(400).json({
                    data: null,
                    error: "Queue is not active"
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
                    error: "Patient already in queue"
                });
            }
            const maxTicket = yield db_1.db.queueEntry.findFirst({
                where: { queueId },
                orderBy: { ticketNumber: 'desc' }
            });
            const ticketNumber = maxTicket ? (maxTicket.ticketNumber || 0) + 1 : 1;
            const queueEntry = yield db_1.db.queueEntry.create({
                data: {
                    queueId,
                    patientId,
                    status: 'WAITING',
                    priority: priority || 'NORMAL',
                    notes,
                    ticketNumber
                },
                include: {
                    patient: true,
                    queue: true
                }
            });
            const responseData = {
                id: queueEntry.id,
                ticketNumber: queueEntry.ticketNumber,
                status: queueEntry.status,
                priority: queueEntry.priority,
                createdAt: queueEntry.createdAt,
                patient: {
                    id: queueEntry.patient.id,
                    fileNumber: queueEntry.patient.fileNumber,
                    name: `${queueEntry.patient.firstName} ${queueEntry.patient.lastName}`,
                    gender: queueEntry.patient.gender,
                    age: (0, calculateAge_1.calculateAge)(queueEntry.patient.dateOfBirth)
                },
                queue: { id: ((_a = queueEntry.queue) === null || _a === void 0 ? void 0 : _a.id) || '',
                    name: ((_b = queueEntry.queue) === null || _b === void 0 ? void 0 : _b.name) || 'Queue inconnue'
                },
                notes: queueEntry.notes
            };
            return res.status(201).json({
                data: responseData,
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
function addPatientAllergy(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { patientId } = req.params;
        const { allergen, allergenType, severity, reaction, diagnosedDate, notes } = req.body;
        try {
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient not found"
                });
            }
            const existingAllergy = yield db_1.db.patientAllergy.findFirst({
                where: {
                    patientId,
                    allergen
                }
            });
            if (existingAllergy) {
                return res.status(409).json({
                    data: null,
                    error: "This allergy is already registered for this patient"
                });
            }
            const patientAllergy = yield db_1.db.patientAllergy.create({
                data: {
                    patientId,
                    allergen,
                    severity,
                    reaction,
                    diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : undefined,
                    notes,
                    isActive: true
                }
            });
            return res.status(201).json({
                data: {
                    id: patientAllergy.id,
                    allergen: patientAllergy.allergen,
                    severity: patientAllergy.severity,
                    reaction: patientAllergy.reaction,
                    diagnosedDate: patientAllergy.diagnosedDate,
                    notes: patientAllergy.notes,
                    isActive: patientAllergy.isActive
                },
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
function addMedicalHistory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { patientId } = req.params;
        const { condition, diagnosedDate, notes } = req.body;
        try {
            const patient = yield db_1.db.patient.findUnique({
                where: { id: patientId }
            });
            if (!patient) {
                return res.status(404).json({
                    data: null,
                    error: "Patient not found"
                });
            }
            const existingCondition = yield db_1.db.medicalHistory.findFirst({
                where: {
                    patientId,
                    condition
                }
            });
            if (existingCondition) {
                return res.status(409).json({
                    data: null,
                    error: "This medical condition is already registered for this patient"
                });
            }
            const medicalHistory = yield db_1.db.medicalHistory.create({
                data: {
                    patientId,
                    condition,
                    diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : new Date(), notes
                }
            });
            return res.status(201).json({
                data: {
                    id: medicalHistory.id,
                    condition: medicalHistory.condition,
                    diagnosedDate: medicalHistory.diagnosedDate,
                    notes: medicalHistory.notes
                },
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
function getRecentPatients(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { limit = '10' } = req.query;
        try {
            const limitNumber = parseInt(limit, 10);
            const recentPatients = yield db_1.db.patient.findMany({
                orderBy: { createdAt: 'desc' },
                take: limitNumber
            });
            const patientsWithAge = recentPatients.map(patient => (Object.assign(Object.assign({}, patient), { age: patient.dateOfBirth ? (0, calculateAge_1.calculateAge)(patient.dateOfBirth) : null })));
            return res.status(200).json({
                data: patientsWithAge,
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
function getPatients(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const patients = yield db_1.db.patient.findMany({
                orderBy: {
                    createdAt: "desc"
                },
                include: {
                    _count: {
                        select: {
                            consultations: true,
                            prescriptions: true,
                            allergies: true,
                            medicalHistories: true
                        }
                    }
                }
            });
            const patientsWithAge = patients.map(patient => (Object.assign(Object.assign({}, patient), { age: (0, calculateAge_1.calculateAge)(patient.dateOfBirth) })));
            return res.status(200).json({
                data: patientsWithAge,
                error: null
            });
        }
        catch (error) {
            console.error("Error fetching patients:", error);
            return res.status(500).json({
                data: null,
                error: "Failed to fetch patients"
            });
        }
    });
}
