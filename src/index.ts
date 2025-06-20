import express from "express";
import patientRouter from "./routes/patients";
import queueRouter from "./routes/queue";
import consultationRouter from "./routes/consultations";
import hospitalRouter from "./routes/hospitals";
import departmentRouter from "./routes/departments";
import chefComplaintRouter from "./routes/chefcomplaints";
import userRouter from "./routes/user";
import medicationRouter from "./routes/medications";
import categoryRouter from "./routes/categories";
require("dotenv").config();
const cors = require("cors");
const app = express();

app.use(cors());

const PORT = process.env.PORT || 8000;

app.use(express.json());
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`); // Log a message indicating the server is running
});

app.use("/api/v1", hospitalRouter);
//app.use("/api/v1", adminRouter);
app.use("/api/v1", consultationRouter);
app.use("/api/v1", queueRouter);
app.use("/api/v1", patientRouter);
app.use("/api/v1", departmentRouter);
app.use("/api/v1", chefComplaintRouter);
app.use("/api/v1", medicationRouter);
app.use("/api/v1", categoryRouter);
app.use("/api/v1", userRouter);
 
 
