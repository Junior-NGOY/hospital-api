import { 
  addToQueue,
    createQueue, 
    getQueues, 
    //getQueueById, 
    //updateQueue, 
    //deleteQueue,
    //updateQueueEntry,
    //callNextPatient,
    getQueueDisplay,
    getQueueDisplayAll,
    getQueueById
  } from "@/controllers/queues";
  import express from "express";
  
  const queueRouter = express.Router();
  
  queueRouter.post("/queues", createQueue);
  queueRouter.get("/queues", getQueues);
  queueRouter.get("/queues/:id", getQueueById);
  //queueRouter.put("/queues/:id", updateQueue);
  //queueRouter.delete("/queues/:id", deleteQueue);
  queueRouter.post("/queues/entries", addToQueue);
  //queueRouter.put("/queues/entries/:id", updateQueueEntry);
  //queueRouter.post("/queues/:id/next", callNextPatient);
  queueRouter.get("/queues/display", getQueueDisplayAll);
  queueRouter.get("/queues/:queueId/display", getQueueDisplay);
  export default queueRouter;