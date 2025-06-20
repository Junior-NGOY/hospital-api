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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.getAllUsers = getAllUsers;
exports.getUserById = getUserById;
exports.updateUser = updateUser;
exports.changePassword = changePassword;
exports.resetPassword = resetPassword;
exports.deactivateUser = deactivateUser;
exports.activateUser = activateUser;
exports.deleteUser = deleteUser;
exports.getUsersByRole = getUsersByRole;
exports.getUsersByHospital = getUsersByHospital;
exports.getUsersByBranch = getUsersByBranch;
const db_1 = require("../db/db");
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
function createUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, password, firstName, lastName, role, hospitalId, branchId, phone, isActive = true, specialization, licenseNumber, position } = req.body;
        try {
            const existingUser = yield db_1.db.user.findUnique({
                where: {
                    email
                }
            });
            if (existingUser) {
                return res.status(409).json({
                    data: null,
                    error: "Un utilisateur avec cet email existe déjà"
                });
            }
            if (hospitalId) {
                const hospital = yield db_1.db.hospital.findUnique({
                    where: {
                        id: hospitalId
                    }
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
                    where: {
                        id: branchId
                    }
                });
                if (!branch) {
                    return res.status(404).json({
                        data: null,
                        error: "Branche d'hôpital non trouvée"
                    });
                }
            }
            if (role === "DOCTOR" && !specialization) {
                return res.status(400).json({
                    data: null,
                    error: "La spécialisation est requise pour les médecins"
                });
            }
            if ((role === "DOCTOR" || role === "NURSE" || role === "PHARMACIST") && !licenseNumber) {
                return res.status(400).json({
                    data: null,
                    error: "Le numéro de licence est requis pour ce rôle"
                });
            }
            if (role === "ADMINISTRATOR" && !position) {
                return res.status(400).json({
                    data: null,
                    error: "La position est requise pour les administrateurs"
                });
            }
            const hashedPassword = "1234";
            const newUser = yield db_1.db.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    role,
                    hospitalId,
                    branchId,
                    phone,
                    isActive
                }
            });
            switch (role) {
                case "DOCTOR":
                    yield db_1.db.doctor.create({
                        data: {
                            userId: newUser.id,
                            licenseNumber: licenseNumber,
                            specialization: specialization
                        }
                    });
                    break;
                case "NURSE":
                    yield db_1.db.nurse.create({
                        data: {
                            userId: newUser.id,
                            licenseNumber: licenseNumber,
                        }
                    });
                    break;
                case "ADMINISTRATOR":
                    yield db_1.db.administrator.create({
                        data: {
                            userId: newUser.id,
                            position: position,
                        }
                    });
                    break;
                case "RECEPTIONIST":
                    yield db_1.db.receptionist.create({
                        data: {
                            userId: newUser.id
                        }
                    });
                    break;
                case "LAB_TECHNICIAN":
                    yield db_1.db.labTechnician.create({
                        data: {
                            userId: newUser.id,
                            specialization: specialization
                        }
                    });
                    break;
                case "ACCOUNTANT":
                    yield db_1.db.accountant.create({
                        data: {
                            userId: newUser.id
                        }
                    });
                    break;
                case "PHARMACIST":
                    yield db_1.db.pharmacist.create({
                        data: {
                            userId: newUser.id,
                            licenseNumber: licenseNumber,
                        }
                    });
                    break;
            }
            const createdUser = yield db_1.db.user.findUnique({
                where: {
                    id: newUser.id
                },
                include: {
                    doctor: role === "DOCTOR",
                    nurse: role === "NURSE",
                    administrator: role === "ADMINISTRATOR",
                    receptionist: role === "RECEPTIONIST",
                    labTechnician: role === "LAB_TECHNICIAN",
                    accountant: role === "ACCOUNTANT",
                    pharmacist: role === "PHARMACIST",
                    hospital: hospitalId ? {
                        select: {
                            id: true,
                            name: true
                        }
                    } : false,
                    branch: branchId ? {
                        select: {
                            id: true,
                            name: true
                        }
                    } : false
                }
            });
            const _a = createdUser, { password: _ } = _a, userWithoutPassword = __rest(_a, ["password"]);
            return res.status(201).json({
                data: userWithoutPassword,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la création de l'utilisateur"
            });
        }
    });
}
function getAllUsers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { hospitalId, branchId, role, isActive, page = "1", limit = "10" } = req.query;
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;
        try {
            const where = {};
            if (hospitalId)
                where.hospitalId = hospitalId;
            if (branchId)
                where.branchId = branchId;
            if (role)
                where.role = role;
            if (isActive !== undefined)
                where.isActive = isActive === "true";
            const totalUsers = yield db_1.db.user.count({ where });
            const users = yield db_1.db.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    phone: true,
                    createdAt: true,
                    hospital: hospitalId ? {
                        select: {
                            id: true,
                            name: true
                        }
                    } : false,
                    branch: branchId ? {
                        select: {
                            id: true,
                            name: true
                        }
                    } : false,
                    doctor: {
                        select: {
                            specialization: true,
                            licenseNumber: true
                        }
                    },
                    nurse: {
                        select: {
                            licenseNumber: true,
                            specialization: true
                        }
                    },
                    administrator: {
                        select: {
                            position: true
                        }
                    },
                    pharmacist: {
                        select: {
                            licenseNumber: true
                        }
                    },
                    labTechnician: {
                        select: {
                            specialization: true
                        }
                    }
                },
                orderBy: {
                    lastName: "asc"
                },
                skip,
                take: limitNumber
            });
            return res.status(200).json({
                data: {
                    users,
                    pagination: {
                        total: totalUsers,
                        page: pageNumber,
                        limit: limitNumber,
                        totalPages: Math.ceil(totalUsers / limitNumber)
                    }
                },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des utilisateurs"
            });
        }
    });
}
function getUserById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const user = yield db_1.db.user.findUnique({
                where: {
                    id
                },
                include: {
                    doctor: true,
                    nurse: true,
                    administrator: true,
                    receptionist: true,
                    labTechnician: true,
                    accountant: true,
                    pharmacist: true,
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
                    }
                }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            const { password } = user, userWithoutPassword = __rest(user, ["password"]);
            return res.status(200).json({
                data: userWithoutPassword,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération de l'utilisateur"
            });
        }
    });
}
function updateUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { firstName, lastName, phone, hospitalId, branchId, isActive, specialization, licenseNumber, position } = req.body;
        try {
            const existingUser = yield db_1.db.user.findUnique({
                where: {
                    id
                },
                include: {
                    doctor: true,
                    nurse: true,
                    administrator: true,
                    labTechnician: true,
                    pharmacist: true
                }
            });
            if (!existingUser) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            if (hospitalId) {
                const hospital = yield db_1.db.hospital.findUnique({
                    where: {
                        id: hospitalId
                    }
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
                    where: {
                        id: branchId
                    }
                });
                if (!branch) {
                    return res.status(404).json({
                        data: null,
                        error: "Branche d'hôpital non trouvée"
                    });
                }
            }
            const updatedUser = yield db_1.db.user.update({
                where: {
                    id
                },
                data: {
                    firstName: firstName || undefined,
                    lastName: lastName || undefined,
                    phone: phone || undefined,
                    hospitalId: hospitalId || undefined,
                    branchId: branchId || undefined,
                    isActive: isActive !== undefined ? isActive : undefined
                },
                include: {
                    doctor: true,
                    nurse: true,
                    administrator: true,
                    receptionist: true,
                    labTechnician: true,
                    accountant: true,
                    pharmacist: true,
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
                    }
                }
            });
            switch (existingUser.role) {
                case "DOCTOR":
                    if (existingUser.doctor && (specialization || licenseNumber)) {
                        yield db_1.db.doctor.update({
                            where: {
                                userId: id
                            },
                            data: {
                                specialization: specialization || undefined,
                                licenseNumber: licenseNumber || undefined
                            }
                        });
                    }
                    break;
                case "NURSE":
                    if (existingUser.nurse && licenseNumber) {
                        yield db_1.db.nurse.update({
                            where: {
                                userId: id
                            },
                            data: {
                                licenseNumber
                            }
                        });
                    }
                    break;
                case "ADMINISTRATOR":
                    if (existingUser.administrator && position) {
                        yield db_1.db.administrator.update({
                            where: {
                                userId: id
                            },
                            data: {
                                position
                            }
                        });
                    }
                    break;
                case "LAB_TECHNICIAN":
                    if (existingUser.labTechnician && licenseNumber) {
                        yield db_1.db.labTechnician.update({
                            where: {
                                userId: id
                            },
                            data: {
                                specialization: specialization
                            }
                        });
                    }
                    break;
                case "PHARMACIST":
                    if (existingUser.pharmacist && licenseNumber) {
                        yield db_1.db.pharmacist.update({
                            where: {
                                userId: id
                            },
                            data: {
                                licenseNumber
                            }
                        });
                    }
                    break;
            }
            const { password } = updatedUser, userWithoutPassword = __rest(updatedUser, ["password"]);
            return res.status(200).json({
                data: userWithoutPassword,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la mise à jour de l'utilisateur"
            });
        }
    });
}
function changePassword(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { currentPassword, newPassword } = req.body;
        try {
            const user = yield db_1.db.user.findUnique({
                where: {
                    id
                }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            const isPasswordValid = yield bcrypt_1.default.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    data: null,
                    error: "Mot de passe actuel incorrect"
                });
            }
            const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
            yield db_1.db.user.update({
                where: {
                    id
                },
                data: {
                    password: hashedPassword
                }
            });
            return res.status(200).json({
                data: { message: "Mot de passe modifié avec succès" },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors du changement de mot de passe"
            });
        }
    });
}
function resetPassword(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const { newPassword } = req.body;
        try {
            const user = yield db_1.db.user.findUnique({
                where: {
                    id
                }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
            yield db_1.db.user.update({
                where: {
                    id
                },
                data: {
                    password: hashedPassword
                }
            });
            return res.status(200).json({
                data: { message: "Mot de passe réinitialisé avec succès" },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la réinitialisation du mot de passe"
            });
        }
    });
}
function deactivateUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const user = yield db_1.db.user.findUnique({
                where: {
                    id
                }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            const updatedUser = yield db_1.db.user.update({
                where: {
                    id
                },
                data: {
                    isActive: false
                }
            });
            const { password } = updatedUser, userWithoutPassword = __rest(updatedUser, ["password"]);
            return res.status(200).json({
                data: userWithoutPassword,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la désactivation de l'utilisateur"
            });
        }
    });
}
function activateUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const user = yield db_1.db.user.findUnique({
                where: {
                    id
                }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            const updatedUser = yield db_1.db.user.update({
                where: {
                    id
                },
                data: {
                    isActive: true
                }
            });
            const { password } = updatedUser, userWithoutPassword = __rest(updatedUser, ["password"]);
            return res.status(200).json({
                data: userWithoutPassword,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la réactivation de l'utilisateur"
            });
        }
    });
}
function deleteUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const user = yield db_1.db.user.findUnique({
                where: {
                    id
                },
                include: {
                    doctor: {
                        include: {
                            consultations: {
                                take: 1
                            },
                            surgeries: {
                                take: 1
                            }
                        }
                    },
                    nurse: {
                        include: {
                            vitalSigns: {
                                take: 1
                            },
                            medications: {
                                take: 1
                            }
                        }
                    }
                }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "Utilisateur non trouvé"
                });
            }
            if ((user.doctor && (user.doctor.consultations.length > 0 || user.doctor.surgeries.length > 0)) ||
                (user.nurse && (user.nurse.vitalSigns.length > 0 || user.nurse.medications.length > 0))) {
                return res.status(400).json({
                    data: null,
                    error: "Impossible de supprimer cet utilisateur car il a des données associées. Désactivez-le plutôt."
                });
            }
            switch (user.role) {
                case "DOCTOR":
                    if (user.doctor) {
                        yield db_1.db.doctor.delete({
                            where: {
                                userId: id
                            }
                        });
                    }
                    break;
                case "NURSE":
                    if (user.nurse) {
                        yield db_1.db.nurse.delete({
                            where: {
                                userId: id
                            }
                        });
                    }
                    break;
                case "ADMINISTRATOR":
                    yield db_1.db.administrator.delete({
                        where: {
                            userId: id
                        }
                    });
                    break;
                case "RECEPTIONIST":
                    yield db_1.db.receptionist.delete({
                        where: {
                            userId: id
                        }
                    });
                    break;
                case "LAB_TECHNICIAN":
                    yield db_1.db.labTechnician.delete({
                        where: {
                            userId: id
                        }
                    });
                    break;
                case "ACCOUNTANT":
                    yield db_1.db.accountant.delete({
                        where: {
                            userId: id
                        }
                    });
                    break;
                case "PHARMACIST":
                    yield db_1.db.pharmacist.delete({
                        where: {
                            userId: id
                        }
                    });
                    break;
            }
            yield db_1.db.user.delete({
                where: {
                    id
                }
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
                error: "Une erreur est survenue lors de la suppression de l'utilisateur"
            });
        }
    });
}
function getUsersByRole(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { role } = req.params;
        const { hospitalId, branchId, isActive, page = "1", limit = "10" } = req.query;
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;
        try {
            if (!Object.values(client_1.UserRole).includes(role)) {
                return res.status(400).json({
                    data: null,
                    error: "Rôle invalide"
                });
            }
            const where = { role: role };
            if (hospitalId)
                where.hospitalId = hospitalId;
            if (branchId)
                where.branchId = branchId;
            if (isActive !== undefined)
                where.isActive = isActive === "true";
            const totalUsers = yield db_1.db.user.count({ where });
            const users = yield db_1.db.user.findMany({
                where,
                include: {
                    doctor: role === "DOCTOR",
                    nurse: role === "NURSE",
                    administrator: role === "ADMINISTRATOR",
                    receptionist: role === "RECEPTIONIST",
                    labTechnician: role === "LAB_TECHNICIAN",
                    accountant: role === "ACCOUNTANT",
                    pharmacist: role === "PHARMACIST",
                    hospital: hospitalId ? {
                        select: {
                            id: true,
                            name: true
                        }
                    } : false,
                    branch: branchId ? {
                        select: {
                            id: true,
                            name: true
                        }
                    } : false
                },
                orderBy: {
                    lastName: "asc"
                },
                skip,
                take: limitNumber
            });
            const usersWithoutPasswords = users.map(user => {
                const { password } = user, userWithoutPassword = __rest(user, ["password"]);
                return userWithoutPassword;
            });
            return res.status(200).json({
                data: {
                    users: usersWithoutPasswords,
                    pagination: {
                        total: totalUsers,
                        page: pageNumber,
                        limit: limitNumber,
                        totalPages: Math.ceil(totalUsers / limitNumber)
                    }
                },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: `Une erreur est survenue lors de la récupération des utilisateurs avec le rôle ${role}`
            });
        }
    });
}
function getUsersByHospital(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { hospitalId } = req.params;
        const { role, isActive, page = "1", limit = "10" } = req.query;
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;
        try {
            const hospital = yield db_1.db.hospital.findUnique({
                where: {
                    id: hospitalId
                }
            });
            if (!hospital) {
                return res.status(404).json({
                    data: null,
                    error: "Hôpital non trouvé"
                });
            }
            const where = { hospitalId };
            if (role)
                where.role = role;
            if (isActive !== undefined)
                where.isActive = isActive === "true";
            const totalUsers = yield db_1.db.user.count({ where });
            const users = yield db_1.db.user.findMany({
                where,
                include: {
                    doctor: true,
                    nurse: true,
                    administrator: true,
                    receptionist: true,
                    labTechnician: true,
                    accountant: true,
                    pharmacist: true,
                    branch: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: [
                    {
                        role: "asc"
                    },
                    {
                        lastName: "asc"
                    }
                ],
                skip,
                take: limitNumber
            });
            const usersWithoutPasswords = users.map(user => {
                const { password } = user, userWithoutPassword = __rest(user, ["password"]);
                return userWithoutPassword;
            });
            return res.status(200).json({
                data: {
                    users: usersWithoutPasswords,
                    hospital: {
                        id: hospital.id,
                        name: hospital.name
                    },
                    pagination: {
                        total: totalUsers,
                        page: pageNumber,
                        limit: limitNumber,
                        totalPages: Math.ceil(totalUsers / limitNumber)
                    }
                },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des utilisateurs de l'hôpital"
            });
        }
    });
}
function getUsersByBranch(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { branchId } = req.params;
        const { role, isActive, page = "1", limit = "10" } = req.query;
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;
        try {
            const branch = yield db_1.db.hospitalBranch.findUnique({
                where: {
                    id: branchId
                }
            });
            if (!branch) {
                return res.status(404).json({
                    data: null,
                    error: "Branche d'hôpital non trouvée"
                });
            }
            const where = { branchId };
            if (role)
                where.role = role;
            if (isActive !== undefined)
                where.isActive = isActive === "true";
            const totalUsers = yield db_1.db.user.count({ where });
            const users = yield db_1.db.user.findMany({
                where,
                include: {
                    doctor: true,
                    nurse: true,
                    administrator: true,
                    receptionist: true,
                    labTechnician: true,
                    accountant: true,
                    pharmacist: true,
                    hospital: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: [
                    {
                        role: "asc"
                    },
                    {
                        lastName: "asc"
                    }
                ],
                skip,
                take: limitNumber
            });
            const usersWithoutPasswords = users.map(user => {
                const { password } = user, userWithoutPassword = __rest(user, ["password"]);
                return userWithoutPassword;
            });
            return res.status(200).json({
                data: {
                    users: usersWithoutPasswords,
                    branch: {
                        id: branch.id,
                        name: branch.name,
                        hospitalId: branch.hospitalId
                    },
                    pagination: {
                        total: totalUsers,
                        page: pageNumber,
                        limit: limitNumber,
                        totalPages: Math.ceil(totalUsers / limitNumber)
                    }
                },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Une erreur est survenue lors de la récupération des utilisateurs de la branche"
            });
        }
    });
}
