import {
  addToQueue,
  createQueue,
  getQueues,
  updateQueue,
  deleteQueue,
  updateQueueEntry,
  callNextPatient,
  callSpecificPatient,
  getQueueDisplay,
  getQueueDisplayAll,
  getQueueById,
  transferPatient,
  getQueuesOverview,
} from "@/controllers/queues";
import { authenticate } from "@/middleware/auth";
import express from "express";

const queueRouter = express.Router();

// Static paths before /:queueId so "display" / "overview" / "entries" are not captured.
queueRouter.post("/queues", authenticate, createQueue);
queueRouter.get("/queues", authenticate, getQueues);
queueRouter.get("/queues/display", getQueueDisplayAll);
queueRouter.get("/queues/overview", authenticate, getQueuesOverview);
queueRouter.post("/queues/entries", authenticate, addToQueue);
queueRouter.put("/queues/entries/:entryId", authenticate, updateQueueEntry);
queueRouter.post("/queues/entries/:entryId/call", authenticate, callSpecificPatient);
queueRouter.post("/queues/entries/:entryId/transfer", authenticate, transferPatient);
queueRouter.get("/queues/:queueId/display", getQueueDisplay);
queueRouter.post("/queues/:queueId/call-next", authenticate, callNextPatient);
queueRouter.get("/queues/:queueId", authenticate, getQueueById);
queueRouter.put("/queues/:queueId", authenticate, updateQueue);
queueRouter.delete("/queues/:queueId", authenticate, deleteQueue);

export default queueRouter;