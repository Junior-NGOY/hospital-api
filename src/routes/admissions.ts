import {
  createAdmission,
  createAdmissionVitalSigns,
  dischargeAdmission,
  getAdmissionById,
  getAdmissionStats,
  getAdmissions,
  getHospitalDoctors,
  transferAdmission,
  updateAdmission,
} from "@/controllers/admissions";
import {
  createBed,
  deleteBed,
  getBedById,
  getBeds,
  updateBed,
} from "@/controllers/beds";
import {
  createRoom,
  deleteRoom,
  getRoomById,
  getRooms,
  updateRoom,
} from "@/controllers/rooms";
import { authenticate, requireRoles } from "@/middleware/auth";
import express from "express";

const hospitalizationRouter = express.Router();

hospitalizationRouter.get("/rooms", authenticate, getRooms);
hospitalizationRouter.post("/rooms", authenticate, createRoom);
hospitalizationRouter.get("/rooms/:id", authenticate, getRoomById);
hospitalizationRouter.put("/rooms/:id", authenticate, updateRoom);
hospitalizationRouter.delete("/rooms/:id", authenticate, deleteRoom);

hospitalizationRouter.get("/beds", authenticate, getBeds);
hospitalizationRouter.post("/beds", authenticate, createBed);
hospitalizationRouter.get("/beds/:id", authenticate, getBedById);
hospitalizationRouter.put("/beds/:id", authenticate, updateBed);
hospitalizationRouter.delete("/beds/:id", authenticate, deleteBed);

hospitalizationRouter.get("/admissions", authenticate, getAdmissions);
hospitalizationRouter.post("/admissions", authenticate, createAdmission);
hospitalizationRouter.get("/admissions/stats", authenticate, getAdmissionStats);
hospitalizationRouter.get("/admissions/doctors", authenticate, getHospitalDoctors);
hospitalizationRouter.get("/admissions/:id", authenticate, getAdmissionById);
hospitalizationRouter.put("/admissions/:id", authenticate, updateAdmission);
hospitalizationRouter.post(
  "/admissions/:id/discharge",
  authenticate,
  dischargeAdmission
);
hospitalizationRouter.post(
  "/admissions/:id/transfer",
  authenticate,
  transferAdmission
);
hospitalizationRouter.post(
  "/admissions/:id/vital-signs",
  authenticate,
  requireRoles("DOCTOR", "NURSE"),
  createAdmissionVitalSigns
);

export default hospitalizationRouter;
