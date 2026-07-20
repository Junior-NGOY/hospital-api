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
exports.createVehicle = createVehicle;
exports.getVehicles = getVehicles;
exports.getVehicleById = getVehicleById;
exports.updateVehicle = updateVehicle;
exports.deleteVehicle = deleteVehicle;
const db_1 = require("../db/db");
function toDate(value) {
    if (!value)
        return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
function createVehicle(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            const data = req.body;
            if (!((_a = data.name) === null || _a === void 0 ? void 0 : _a.trim()) || !((_b = data.licensePlate) === null || _b === void 0 ? void 0 : _b.trim()) || !data.type) {
                return res.status(400).json({
                    data: null,
                    error: "name, type et licensePlate sont requis",
                });
            }
            const created = yield db_1.db.vehicle.create({
                data: {
                    name: data.name.trim(),
                    type: data.type,
                    licensePlate: data.licensePlate.trim(),
                    hospitalId: data.hospitalId || null,
                    branchId: data.branchId || null,
                    brand: data.brand || null,
                    model: data.model || null,
                    year: (_c = data.year) !== null && _c !== void 0 ? _c : null,
                    vin: data.vin || null,
                    fuelType: data.fuelType || null,
                    capacity: (_d = data.capacity) !== null && _d !== void 0 ? _d : null,
                    mileage: (_e = data.mileage) !== null && _e !== void 0 ? _e : null,
                    lastServiceDate: toDate(data.lastServiceDate),
                    nextServiceDate: toDate(data.nextServiceDate),
                    insuranceExpiry: toDate(data.insuranceExpiry),
                    registrationExpiry: toDate(data.registrationExpiry),
                    status: data.status || "AVAILABLE",
                    location: data.location || null,
                    assignedDriverId: data.assignedDriverId || null,
                    purchaseDate: toDate(data.purchaseDate),
                    purchasePrice: (_f = data.purchasePrice) !== null && _f !== void 0 ? _f : null,
                    currentValue: (_h = (_g = data.currentValue) !== null && _g !== void 0 ? _g : data.purchasePrice) !== null && _h !== void 0 ? _h : null,
                },
            });
            return res.status(201).json({ data: created, error: null });
        }
        catch (error) {
            console.error("createVehicle error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la création du véhicule" });
        }
    });
}
function getVehicles(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { hospitalId, branchId, type, status, search, page = "1", limit = "50" } = req.query;
            const where = {};
            if (hospitalId)
                where.hospitalId = String(hospitalId);
            if (branchId)
                where.branchId = String(branchId);
            if (type)
                where.type = String(type);
            if (status)
                where.status = String(status);
            if (search) {
                where.OR = [
                    { name: { contains: String(search), mode: "insensitive" } },
                    { licensePlate: { contains: String(search), mode: "insensitive" } },
                    { brand: { contains: String(search), mode: "insensitive" } },
                ];
            }
            const skip = (Number(page) - 1) * Number(limit);
            const [vehicles, total] = yield Promise.all([
                db_1.db.vehicle.findMany({
                    where,
                    orderBy: { updatedAt: "desc" },
                    skip,
                    take: Number(limit),
                }),
                db_1.db.vehicle.count({ where }),
            ]);
            return res.status(200).json({
                data: {
                    vehicles,
                    pagination: {
                        total,
                        page: Number(page),
                        limit: Number(limit),
                        totalPages: Math.ceil(total / Number(limit)) || 1,
                    },
                },
                error: null,
            });
        }
        catch (error) {
            console.error("getVehicles error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la récupération des véhicules" });
        }
    });
}
function getVehicleById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const vehicle = yield db_1.db.vehicle.findUnique({ where: { id: req.params.id } });
            if (!vehicle) {
                return res.status(404).json({ data: null, error: "Véhicule introuvable" });
            }
            return res.status(200).json({ data: vehicle, error: null });
        }
        catch (error) {
            console.error("getVehicleById error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la récupération du véhicule" });
        }
    });
}
function updateVehicle(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const data = req.body;
            const existing = yield db_1.db.vehicle.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ data: null, error: "Véhicule introuvable" });
            }
            const updated = yield db_1.db.vehicle.update({
                where: { id },
                data: {
                    name: data.name !== undefined ? data.name.trim() : undefined,
                    type: data.type !== undefined ? data.type : undefined,
                    licensePlate: data.licensePlate !== undefined ? data.licensePlate.trim() : undefined,
                    hospitalId: data.hospitalId !== undefined ? data.hospitalId || null : undefined,
                    branchId: data.branchId !== undefined ? data.branchId || null : undefined,
                    brand: data.brand !== undefined ? data.brand || null : undefined,
                    model: data.model !== undefined ? data.model || null : undefined,
                    year: data.year !== undefined ? data.year : undefined,
                    vin: data.vin !== undefined ? data.vin || null : undefined,
                    fuelType: data.fuelType !== undefined ? data.fuelType || null : undefined,
                    capacity: data.capacity !== undefined ? data.capacity : undefined,
                    mileage: data.mileage !== undefined ? data.mileage : undefined,
                    lastServiceDate: data.lastServiceDate !== undefined ? toDate(data.lastServiceDate) : undefined,
                    nextServiceDate: data.nextServiceDate !== undefined ? toDate(data.nextServiceDate) : undefined,
                    insuranceExpiry: data.insuranceExpiry !== undefined ? toDate(data.insuranceExpiry) : undefined,
                    registrationExpiry: data.registrationExpiry !== undefined ? toDate(data.registrationExpiry) : undefined,
                    status: data.status !== undefined ? data.status || null : undefined,
                    location: data.location !== undefined ? data.location || null : undefined,
                    assignedDriverId: data.assignedDriverId !== undefined ? data.assignedDriverId || null : undefined,
                    purchaseDate: data.purchaseDate !== undefined ? toDate(data.purchaseDate) : undefined,
                    purchasePrice: data.purchasePrice !== undefined ? data.purchasePrice : undefined,
                    currentValue: data.currentValue !== undefined ? data.currentValue : undefined,
                },
            });
            return res.status(200).json({ data: updated, error: null });
        }
        catch (error) {
            console.error("updateVehicle error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la mise à jour du véhicule" });
        }
    });
}
function deleteVehicle(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const existing = yield db_1.db.vehicle.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ data: null, error: "Véhicule introuvable" });
            }
            yield db_1.db.vehicle.delete({ where: { id } });
            return res.status(200).json({ data: { id }, error: null });
        }
        catch (error) {
            console.error("deleteVehicle error:", error);
            return res.status(500).json({ data: null, error: "Erreur lors de la suppression du véhicule" });
        }
    });
}
