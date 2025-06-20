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
exports.getNursePatients = getNursePatients;
exports.recordVitalSigns = recordVitalSigns;
exports.administerMedication = administerMedication;
const db_1 = require("../db/db");
function getNursePatients(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { nurseId } = req.params;
        try {
            const nurse = yield db_1.db.nurse.findUnique({
                where: { id: nurseId },
                include: {
                    department: true
                }
            });
            if (!nurse) {
                return res.status(404).json({
                    data: null,
                    error: "Infirmier non trouvé"
                });
            }
            if (!nurse.departmentId) {
                return res.status(400).json({
                    data: null,
                    error: "L'infirmier n'est pas assigné à un département"
                });
            }
            const admissions = yield db_1.db.admission.findMany({
                where: {
                    status: 'ACTIVE',
                    bed: {
                        room: {
                            departmentId: nurse.departmentId
                        }
                    }
                },
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            dateOfBirth: true,
                            gender: true,
                            fileNumber: true,
                            bloodType: true
                        }
                    },
                    bed: {
                        include: {
                            room: true
                        }
                    },
                    vitalSigns: {
                        orderBy: {
                            recordedAt: 'desc'
                        },
                        take: 1
                    }
                }
            });
            return res.status(200).json({
                data: admissions,
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
function recordVitalSigns(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { nurseId } = req.params;
        const { patientId, admissionId, consultationId, temperature, heartRate, bloodPressureSys, bloodPressureDia, respiratoryRate, oxygenSaturation, pain, notes } = req.body;
        try {
            const nurse = yield db_1.db.nurse.findUnique({
                where: { id: nurseId }
            });
            if (!nurse) {
                return res.status(404).json({
                    data: null,
                    error: "Infirmier non trouvé"
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
            const vitalSigns = yield db_1.db.vitalSign.create({
                data: {
                    patientId,
                    nurseId,
                    admissionId,
                    consultationId,
                    temperature,
                    notes
                }
            });
            yield db_1.db.patientAccessLog.create({
                data: {
                    patientId,
                    userId: nurse.userId,
                    accessType: 'CREATE',
                }
            });
            return res.status(201).json({
                data: vitalSigns,
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
function administerMedication(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { nurseId } = req.params;
        const { patientId, medicationId, admissionId, dose, route, notes } = req.body;
        try {
            const nurse = yield db_1.db.nurse.findUnique({
                where: { id: nurseId }
            });
            if (!nurse) {
                return res.status(404).json({
                    data: null,
                    error: "Infirmier non trouvé"
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
            const medication = yield db_1.db.medication.findUnique({
                where: { id: medicationId }
            });
            if (!medication) {
                return res.status(404).json({
                    data: null,
                    error: "Médicament non trouvé"
                });
            }
            const administration = yield db_1.db.medicationAdministration.create({
                data: {
                    patientId,
                    nurseId,
                    medication: medication.name,
                    admissionId,
                    dose,
                    route,
                    notes
                }
            });
            yield db_1.db.patientAccessLog.create({
                data: {
                    patientId,
                    userId: nurse.userId,
                    accessType: 'CREATE',
                }
            });
            return res.status(201).json({
                data: administration,
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
