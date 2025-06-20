import { db } from "@/db/db";
import { medicationCategoryProps, TypedRequestBody } from "@/types";
import { Request, Response } from "express";

// Contrôleur temporaire - Le modèle MedicationCategory n'existe pas dans le schéma Prisma
// TODO: Créer le modèle MedicationCategory ou utiliser un autre modèle existant

export async function createMedicationCategory(
  req: TypedRequestBody<medicationCategoryProps>,
  res: Response
) {
  try {
    return res.status(501).json({
      data: null,
      error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}

export async function getCategories(req: Request, res: Response) {
  try {
    return res.status(501).json({
      data: [],
      error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}

export async function getCategoryTree(req: Request, res: Response) {
  try {
    return res.status(501).json({
      data: null,
      error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}

export async function updateMedicationCategory(req: Request, res: Response) {
  try {
    return res.status(501).json({
      data: null,
      error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}

export async function getSingleMedicationCategory(req: Request, res: Response) {
  try {
    return res.status(501).json({
      data: null,
      error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}

export async function deleteMedicationCategory(req: Request, res: Response) {
  try {
    return res.status(501).json({
      data: null,
      error: "Fonctionnalité non implémentée - Le modèle MedicationCategory n'existe pas"
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}