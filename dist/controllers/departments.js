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
exports.createDepartment = createDepartment;
exports.getDepartments = getDepartments;
exports.getDepartmentById = getDepartmentById;
exports.updateDepartment = updateDepartment;
exports.deleteDepartment = deleteDepartment;
exports.assignDoctorToDepartment = assignDoctorToDepartment;
exports.removeDoctorFromDepartment = removeDoctorFromDepartment;
exports.getDepartmentStatistics = getDepartmentStatistics;
const db_1 = require("../db/db");
function createDepartment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, description, location, hospitalId, branchId } = req.body;
        try {
            if (!hospitalId && !branchId) {
                return res.status(400).json({
                    data: null,
                    error: "Vous devez spécifier soit un hôpital, soit une branche"
                });
            }
            if (hospitalId) {
                const hospital = yield db_1.db.hospital.findUnique({
                    where: { id: hospitalId }
                });
                if (!hospital) {
                    return res.status(404).json({
                        data: null,
                        error: "Hôpital non trouvé"
                    });
                }
            }
            if (branchId) {
                const branch = yield db_1.db.hospitalBranch.findUnique({
                    where: { id: branchId }
                });
                if (!branch) {
                    return res.status(404).json({
                        data: null,
                        error: "Branche non trouvée"
                    });
                }
            }
            const newDepartment = yield db_1.db.department.create({
                data: {
                    name,
                    description,
                    location,
                    hospitalId,
                    branchId
                }
            });
            return res.status(201).json({
                data: newDepartment,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la création du département"
            });
        }
    });
}
function getDepartments(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { hospitalId, branchId } = req.query;
        try {
            const where = {};
            if (hospitalId) {
                where.hospitalId = hospitalId;
            }
            if (branchId) {
                where.branchId = branchId;
            }
            const departments = yield db_1.db.department.findMany({
                where,
                orderBy: { name: "asc" },
                include: {
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
                            doctors: true,
                            nurses: true,
                            rooms: true,
                            queues: true
                        }
                    }
                }
            });
            return res.status(200).json({
                data: departments,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des départements"
            });
        }
    });
}
function getDepartmentById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const department = yield db_1.db.department.findUnique({
                where: { id },
                include: {
                    hospital: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    }, branch: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    doctors: {
                        include: {
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
                            }
                        }
                    },
                    nurses: {
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
                    rooms: true,
                    queues: true
                }
            });
            if (!department) {
                return res.status(404).json({
                    data: null,
                    error: "Département non trouvé"
                });
            }
            return res.status(200).json({
                data: department,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération du département"
            });
        }
    });
}
function updateDepartment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { name, description, location, hospitalId, branchId } = req.body;
        try {
            const department = yield db_1.db.department.findUnique({
                where: { id }
            });
            if (!department) {
                return res.status(404).json({
                    data: null,
                    error: "Département non trouvé"
                });
            }
            if (hospitalId) {
                const hospital = yield db_1.db.hospital.findUnique({
                    where: { id: hospitalId }
                });
                if (!hospital) {
                    return res.status(404).json({
                        data: null,
                        error: "Hôpital non trouvé"
                    });
                }
            }
            if (branchId) {
                const branch = yield db_1.db.hospitalBranch.findUnique({
                    where: { id: branchId }
                });
                if (!branch) {
                    return res.status(404).json({
                        data: null,
                        error: "Branche non trouvée"
                    });
                }
            }
            const updatedDepartment = yield db_1.db.department.update({
                where: { id },
                data: {
                    name: name || undefined,
                    description: description !== undefined ? description : undefined,
                    location: location !== undefined ? location : undefined,
                    hospitalId: hospitalId || undefined,
                    branchId: branchId || undefined
                }
            });
            return res.status(200).json({
                data: updatedDepartment,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la mise à jour du département"
            });
        }
    });
}
function deleteDepartment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const department = yield db_1.db.department.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            doctors: true,
                            nurses: true,
                            rooms: true,
                            queues: true,
                            equipment: true
                        }
                    }
                }
            });
            if (!department) {
                return res.status(404).json({
                    data: null,
                    error: "Département non trouvé"
                });
            }
            if (department._count.doctors > 0 ||
                department._count.nurses > 0 ||
                department._count.rooms > 0 ||
                department._count.queues > 0 ||
                department._count.equipment > 0) {
                return res.status(400).json({
                    data: null,
                    error: "Impossible de supprimer ce département car il contient des médecins, des infirmiers, des salles, des files d'attente ou des équipements"
                });
            }
            yield db_1.db.department.delete({
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
                error: "Une erreur est survenue lors de la suppression du département"
            });
        }
    });
}
function assignDoctorToDepartment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { departmentId, doctorId } = req.body;
        try {
            const department = yield db_1.db.department.findUnique({
                where: { id: departmentId }
            });
            if (!department) {
                return res.status(404).json({
                    data: null,
                    error: "Département non trouvé"
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
            const existingAssignment = yield db_1.db.departmentDoctor.findUnique({
                where: {
                    departmentId_doctorId: {
                        departmentId,
                        doctorId
                    }
                }
            });
            if (existingAssignment) {
                return res.status(409).json({
                    data: null,
                    error: "Ce médecin est déjà assigné à ce département"
                });
            }
            const assignment = yield db_1.db.departmentDoctor.create({
                data: {
                    departmentId,
                    doctorId
                }
            });
            return res.status(201).json({
                data: assignment,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de l'assignation du médecin au département"
            });
        }
    });
}
function removeDoctorFromDepartment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { departmentId, doctorId } = req.params;
        try {
            const assignment = yield db_1.db.departmentDoctor.findUnique({
                where: {
                    departmentId_doctorId: {
                        departmentId,
                        doctorId
                    }
                }
            });
            if (!assignment) {
                return res.status(404).json({
                    data: null,
                    error: "Ce médecin n'est pas assigné à ce département"
                });
            }
            yield db_1.db.departmentDoctor.delete({
                where: {
                    departmentId_doctorId: {
                        departmentId,
                        doctorId
                    }
                }
            });
            return res.status(200).json({
                data: { departmentId, doctorId },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors du retrait du médecin du département"
            });
        }
    });
}
function getDepartmentStatistics(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        try {
            const department = yield db_1.db.department.findUnique({
                where: { id }
            });
            if (!department) {
                return res.status(404).json({
                    data: null,
                    error: "Département non trouvé"
                });
            }
            const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
            const end = endDate ? new Date(endDate) : new Date();
            const admissionStats = yield db_1.db.admissionStatistics.findFirst({
                where: {
                    departmentId: id,
                    date: {
                        gte: start,
                        lte: end
                    }
                },
                orderBy: {
                    date: "desc"
                }
            });
            const financialStats = yield db_1.db.financialStatistics.findFirst({
                where: {
                    departmentId: id,
                    date: {
                        gte: start,
                        lte: end
                    }
                },
                orderBy: {
                    date: "desc"
                }
            });
            const rooms = yield db_1.db.room.findMany({
                where: {
                    departmentId: id
                },
                include: {
                    beds: true
                }
            });
            const totalBeds = rooms.reduce((acc, room) => acc + room.beds.length, 0);
            const occupiedBeds = rooms.reduce((acc, room) => acc + room.beds.filter(bed => bed.isOccupied).length, 0);
            const bedOccupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
            const [doctorCount, nurseCount] = yield Promise.all([
                db_1.db.departmentDoctor.count({
                    where: {
                        departmentId: id
                    }
                }),
                db_1.db.nurse.count({
                    where: {
                        departmentId: id
                    }
                })
            ]);
            const statistics = {
                department: {
                    id: department.id,
                    name: department.name
                },
                period: {
                    start,
                    end
                },
                staff: {
                    doctorCount,
                    nurseCount,
                    totalStaff: doctorCount + nurseCount
                },
                beds: {
                    totalBeds,
                    occupiedBeds,
                    availableBeds: totalBeds - occupiedBeds,
                    occupancyRate: bedOccupancyRate
                },
                admissions: admissionStats || {
                    totalAdmissions: 0,
                    totalDischarges: 0,
                    averageLOS: 0,
                    bedOccupancyRate: 0,
                    readmissionRate: 0
                },
                financial: financialStats || {
                    totalRevenue: 0,
                    privateRevenue: 0,
                    subscriberRevenue: 0,
                    consultationCount: 0,
                    admissionCount: 0
                }
            };
            return res.status(200).json({
                data: statistics,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des statistiques du département"
            });
        }
    });
}
