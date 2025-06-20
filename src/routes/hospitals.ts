 
import { createHospital, getHospitalById, getHospitals } from "@/controllers/hospitals";
import express from "express";
const hospitalRouter = express.Router();

hospitalRouter.post("/hospitals", createHospital);
hospitalRouter.get("/hospitals", getHospitals);
hospitalRouter.get("/hospitals/:id", getHospitalById);
// schoolRouter.get("/api/v2/customers", getV2Customers);

export default hospitalRouter;
