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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
const db_1 = require("../db/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
function createUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { adminId } = req.params;
        const { email, password, firstName, lastName, role, departmentId, specialization, position, licenseNumber, phone, address } = req.body;
        try {
            const admin = yield db_1.db.administrator.findUnique({
                where: { id: adminId },
                include: { user: true }
            });
            if (!admin) {
                return res.status(404).json({
                    data: null,
                    error: "Administrateur non trouvé"
                });
            }
            const existingUser = yield db_1.db.user.findUnique({
                where: { email }
            });
            if (existingUser) {
                return res.status(409).json({
                    data: null,
                    error: "Cet email est déjà utilisé"
                });
            }
            const userData = {
                email,
                password: yield bcrypt_1.default.hash(password, 10),
                firstName,
                lastName,
                role,
                isActive: true
            };
            if (phone)
                userData.phone = phone;
            if (address)
                userData.address = address;
            if (admin.user.hospitalId)
                userData.hospitalId = admin.user.hospitalId;
            if (admin.user.branchId)
                userData.branchId = admin.user.branchId;
            const user = yield db_1.db.user.create({
                data: userData
            });
            if (role === client_1.UserRole.DOCTOR) {
                if (departmentId) {
                    const department = yield db_1.db.department.findUnique({
                        where: { id: departmentId }
                    });
                    if (!department) {
                        return res.status(404).json({
                            data: null,
                            error: "Département non trouvé"
                        });
                    }
                }
                const doctorData = {
                    userId: user.id
                };
                if (specialization)
                    doctorData.specialization = specialization;
                if (departmentId)
                    doctorData.departmentId = departmentId;
                yield db_1.db.doctor.create({
                    data: doctorData
                });
            }
            else if (role === client_1.UserRole.NURSE) {
                if (departmentId) {
                    const department = yield db_1.db.department.findUnique({
                        where: { id: departmentId }
                    });
                    if (!department) {
                        return res.status(404).json({
                            data: null,
                            error: "Département non trouvé"
                        });
                    }
                }
                const nurseData = {
                    userId: user.id
                };
                if (departmentId)
                    nurseData.departmentId = departmentId;
                yield db_1.db.nurse.create({
                    data: nurseData
                });
            }
            else if (role === client_1.UserRole.RECEPTIONIST) {
                yield db_1.db.receptionist.create({
                    data: {
                        userId: user.id
                    }
                });
            }
            else if (role === client_1.UserRole.ADMINISTRATOR) {
                yield db_1.db.administrator.create({
                    data: {
                        userId: user.id,
                        position: position
                    }
                });
            }
            else if (role === client_1.UserRole.PHARMACIST) {
                yield db_1.db.pharmacist.create({
                    data: {
                        userId: user.id,
                        licenseNumber: licenseNumber
                    }
                });
            }
            else if (role === client_1.UserRole.LAB_TECHNICIAN) {
                yield db_1.db.labTechnician.create({
                    data: {
                        userId: user.id
                    }
                });
            }
            else if (role === client_1.UserRole.ACCOUNTANT) {
                yield db_1.db.accountant.create({
                    data: {
                        userId: user.id
                    }
                });
            }
            return res.status(201).json({
                data: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
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
