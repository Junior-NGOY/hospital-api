import {
  createConsultation,
  getConsultations, 

} from "@/controllers/consultations";
import express from "express";
const consultationRouter = express.Router();

consultationRouter.post("/consultations", createConsultation);
consultationRouter.get("/consultations", getConsultations);
//consultationRouter.get("/consultations/brief", getBriefConsultations);
//consultationRouter.post("/streams", createStream);
//consultationRouter.get("/streams", getStreams);
// adminRouter.get("/customers/:id", getCustomerById);
// adminRouter.get("/api/v2/customers", getV2Customers);

export default consultationRouter;   
