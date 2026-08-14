import {
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  deleteAppointment,
  getAppointmentById,
  getAppointmentDoctors,
  getAppointments,
  getDoctorSchedule,
  updateAppointment,
} from "@/controllers/appointments";
import { authenticate } from "@/middleware/auth";
import express from "express";

const appointmentRouter = express.Router();

appointmentRouter.get("/appointments", authenticate, getAppointments);
appointmentRouter.post("/appointments", authenticate, createAppointment);
appointmentRouter.get("/appointments/doctors", authenticate, getAppointmentDoctors);
appointmentRouter.get("/appointments/schedule", authenticate, getDoctorSchedule);
appointmentRouter.get("/appointments/:id", authenticate, getAppointmentById);
appointmentRouter.put("/appointments/:id", authenticate, updateAppointment);
appointmentRouter.post("/appointments/:id/cancel", authenticate, cancelAppointment);
appointmentRouter.post("/appointments/:id/confirm", authenticate, confirmAppointment);
appointmentRouter.delete("/appointments/:id", authenticate, deleteAppointment);

export default appointmentRouter;
