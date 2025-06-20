"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const categories_1 = require("../controllers/categories");
const express_1 = __importDefault(require("express"));
const categoryRouter = express_1.default.Router();
categoryRouter.post("/medication-categorie", categories_1.createMedicationCategory);
categoryRouter.get("/medication-categories", categories_1.getCategories);
categoryRouter.get("/medication-categories/:id/tree", categories_1.getCategoryTree);
categoryRouter.put("/medication-categories/:id", categories_1.updateMedicationCategory);
categoryRouter.delete("/medication-categories/:id", categories_1.deleteMedicationCategory);
exports.default = categoryRouter;
