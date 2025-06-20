"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMedicationCategory = createMedicationCategory;
exports.getCategories = getCategories;
exports.getCategoryTree = getCategoryTree;
exports.updateMedicationCategory = updateMedicationCategory;
exports.getSingleMedicationCategory = getSingleMedicationCategory;
exports.deleteMedicationCategory = deleteMedicationCategory;
function createMedicationCategory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return res.status(501).json({
                data: null,
                error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function getCategories(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return res.status(501).json({
                data: [],
                error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function getCategoryTree(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return res.status(501).json({
                data: null,
                error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function updateMedicationCategory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return res.status(501).json({
                data: null,
                error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function getSingleMedicationCategory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return res.status(501).json({
                data: null,
                error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function deleteMedicationCategory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return res.status(501).json({
                data: null,
                error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
