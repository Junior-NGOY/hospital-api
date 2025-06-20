"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const queues_1 = require("../controllers/queues");
const express_1 = __importDefault(require("express"));
const queueRouter = express_1.default.Router();
queueRouter.post("/queues", queues_1.createQueue);
queueRouter.get("/queues", queues_1.getQueues);
queueRouter.get("/queues/:id", queues_1.getQueueById);
queueRouter.post("/queues/entries", queues_1.addToQueue);
queueRouter.get("/queues/display", queues_1.getQueueDisplayAll);
queueRouter.get("/queues/:queueId/display", queues_1.getQueueDisplay);
exports.default = queueRouter;
