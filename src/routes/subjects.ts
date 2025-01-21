import {
  createSubject,
  getBriefSubjects,
  getSubjects
} from "@/controllers/subjects";
import express from "express";
const subjectRouter = express.Router();

subjectRouter.post("/subjects", createSubject);
subjectRouter.get("/subjects", getSubjects);
subjectRouter.get("/subjects/brief", getBriefSubjects);
//departmentRouter.post("/streams", createStream);
//departmentRouter.get("/streams", getStreams);
// adminRouter.get("/customers/:id", getCustomerById);
// adminRouter.get("/api/v2/customers", getV2Customers);

export default subjectRouter;
