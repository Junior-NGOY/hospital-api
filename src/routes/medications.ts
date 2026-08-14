import {
  adjustMedicationStock,
  createMedication,
  deleteMedication,
  getInventoryLots,
  getMedicationById,
  getMedications,
  getPharmacyAlerts,
  getStockMovements,
  receiveInventory,
  updateMedication,
} from "@/controllers/medications";
import {
  createPrescription,
  dispensePrescription,
  getPrescriptionById,
  getPrescriptions,
} from "@/controllers/prescriptions";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  toggleSupplierStatus,
  updateSupplier,
} from "@/controllers/suppliers";
import { authenticate, requireRoles } from "@/middleware/auth";
import express from "express";

const medicationRouter = express.Router();
const pharmacist = [authenticate, requireRoles("PHARMACIST")] as const;
const medRead = [authenticate, requireRoles("PHARMACIST", "DOCTOR", "NURSE")] as const;
const rxWrite = [authenticate, requireRoles("DOCTOR", "PHARMACIST")] as const;

medicationRouter.post("/medications", ...pharmacist, createMedication);
medicationRouter.get("/medications", ...medRead, getMedications);
medicationRouter.get("/medications/:id", ...medRead, getMedicationById);
medicationRouter.put("/medications/:id", ...pharmacist, updateMedication);
medicationRouter.delete("/medications/:id", ...pharmacist, deleteMedication);
medicationRouter.post("/medications/:id/stock", ...pharmacist, adjustMedicationStock);

medicationRouter.post("/inventory", ...pharmacist, receiveInventory);
medicationRouter.get("/inventory", ...pharmacist, getInventoryLots);
medicationRouter.get("/stock-movements", ...pharmacist, getStockMovements);
medicationRouter.get("/pharmacy/alerts", ...pharmacist, getPharmacyAlerts);

medicationRouter.get("/suppliers", ...pharmacist, getSuppliers);
medicationRouter.post("/suppliers", ...pharmacist, createSupplier);
medicationRouter.get("/suppliers/:id", ...pharmacist, getSupplierById);
medicationRouter.put("/suppliers/:id", ...pharmacist, updateSupplier);
medicationRouter.post("/suppliers/:id/toggle", ...pharmacist, toggleSupplierStatus);
medicationRouter.delete("/suppliers/:id", ...pharmacist, deleteSupplier);

medicationRouter.get("/prescriptions", ...rxWrite, getPrescriptions);
medicationRouter.post("/prescriptions", ...rxWrite, createPrescription);
medicationRouter.get("/prescriptions/:id", ...rxWrite, getPrescriptionById);
medicationRouter.post("/prescriptions/:id/dispense", ...pharmacist, dispensePrescription);

export default medicationRouter;
