import { 
  createPatient,
  getPatients, 
 
  //getPatientById, 
  //updatePatient, 
  //deletePatient, 
  //getPatientHistory 
  getNextPatientSequence,
} from "@/controllers/patients";
import express from "express";

const patientRouter = express.Router();

patientRouter.post("/patients", createPatient);
patientRouter.get("/patients", getPatients);
patientRouter.get("/patients/seq", getNextPatientSequence);
//patientRouter.get("/patients/:id", getPatientById);
//patientRouter.put("/patients/:id", updatePatient);
//patientRouter.delete("/patients/:id", deletePatient);
//patientRouter.get("/patients/:id/history", getPatientHistory);

export default patientRouter;