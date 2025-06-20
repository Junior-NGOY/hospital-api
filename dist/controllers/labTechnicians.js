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
exports.getAssignedLabTests = getAssignedLabTests;
exports.updateLabTestResults = updateLabTestResults;
exports.assignLabTest = assignLabTest;
const db_1 = require("../db/db");
const client_1 = require("@prisma/client");
function getAssignedLabTests(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { technicianId } = req.params;
        try {
            const technician = yield db_1.db.labTechnician.findUnique({
                where: { id: technicianId },
                include: {
                    user: true
                }
            });
            if (!technician) {
                return res.status(404).json({
                    data: null,
                    error: "Technicien de laboratoire non trouvé"
                });
            }
            const labTests = yield db_1.db.labTest.findMany({
                where: {
                    technicianId,
                    status: {
                        in: [client_1.LabTestStatus.PENDING, client_1.LabTestStatus.IN_PROGRESS]
                    }
                },
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            fileNumber: true,
                            dateOfBirth: true,
                            gender: true
                        }
                    },
                    doctor: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            return res.status(200).json({
                data: labTests,
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
function updateLabTestResults(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { technicianId, testId } = req.params;
        const { status, results, notes, completedAt } = req.body;
        try {
            const technician = yield db_1.db.labTechnician.findUnique({
                where: { id: technicianId }
            });
            if (!technician) {
                return res.status(404).json({
                    data: null,
                    error: "Technicien de laboratoire non trouvé"
                });
            }
            const labTest = yield db_1.db.labTest.findUnique({
                where: { id: testId }
            });
            if (!labTest) {
                return res.status(404).json({
                    data: null,
                    error: "Test de laboratoire non trouvé"
                });
            }
            if (labTest.technicianId !== technicianId) {
                return res.status(403).json({
                    data: null,
                    error: "Ce test n'est pas assigné à ce technicien"
                });
            }
            const updateData = {
                status
            };
            if (results !== undefined)
                updateData.results = results;
            if (notes !== undefined)
                updateData.notes = notes;
            if (status === client_1.LabTestStatus.COMPLETED) {
                updateData.completedAt = completedAt ? new Date(completedAt) : new Date();
            }
            const updatedLabTest = yield db_1.db.labTest.update({
                where: { id: testId },
                data: updateData, include: {
                    patient: true,
                    doctor: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });
            return res.status(200).json({
                data: updatedLabTest,
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
function assignLabTest(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { technicianId, testId } = req.params;
        try {
            const technician = yield db_1.db.labTechnician.findUnique({
                where: { id: technicianId }
            });
            if (!technician) {
                return res.status(404).json({
                    data: null,
                    error: "Technicien de laboratoire non trouvé"
                });
            }
            const labTest = yield db_1.db.labTest.findUnique({
                where: { id: testId }
            });
            if (!labTest) {
                return res.status(404).json({
                    data: null,
                    error: "Test de laboratoire non trouvé"
                });
            }
            const updatedLabTest = yield db_1.db.labTest.update({
                where: { id: testId },
                data: {
                    technicianId,
                    status: client_1.LabTestStatus.IN_PROGRESS
                }
            });
            return res.status(200).json({
                data: updatedLabTest,
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
