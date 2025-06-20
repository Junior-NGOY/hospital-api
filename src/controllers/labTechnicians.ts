import { db } from "@/db/db";
import { TypedRequestBody } from "@/types";
import { Request, Response } from "express";
import { LabTestStatus } from "@prisma/client";

/**
 * Récupère les tests de laboratoire assignés à un technicien
 */
export async function getAssignedLabTests(req: Request, res: Response) {
  const { technicianId } = req.params;
  
  try {
    const technician = await db.labTechnician.findUnique({
      where: { id: technicianId },
      include: {
        user: true
      }
    });
    
    if (!technician) {
      return res.status(404).json({
        data: null,
        error: "Technicien de laboratoire non trouvé"
      });
    }
    
    const labTests = await db.labTest.findMany({
      where: {
        technicianId,
        status: {
          in: [LabTestStatus.PENDING, LabTestStatus.IN_PROGRESS]
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fileNumber: true,
            dateOfBirth: true,
            gender: true
          }        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return res.status(200).json({
      data: labTests,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}

/**
 * Met à jour le statut et les résultats d'un test de laboratoire
 */
interface UpdateLabTestProps {
  status: LabTestStatus;
  results?: string;
  notes?: string;
  completedAt?: string;
}

export async function updateLabTestResults(
  req: TypedRequestBody<UpdateLabTestProps>,
  res: Response
) {
  const { technicianId, testId } = req.params;
  const { status, results, notes, completedAt } = req.body;
  
  try {
    const technician = await db.labTechnician.findUnique({
      where: { id: technicianId }
    });
    
    if (!technician) {
      return res.status(404).json({
        data: null,
        error: "Technicien de laboratoire non trouvé"
      });
    }
    
    const labTest = await db.labTest.findUnique({
      where: { id: testId }
    });
    
    if (!labTest) {
      return res.status(404).json({
        data: null,
        error: "Test de laboratoire non trouvé"
      });
    }
    
    if (labTest.technicianId !== technicianId) {
      return res.status(403).json({
        data: null,
        error: "Ce test n'est pas assigné à ce technicien"
      });
    }
    
    const updateData: any = {
      status
    };
    
    if (results !== undefined) updateData.results = results;
    if (notes !== undefined) updateData.notes = notes;
    
    if (status === LabTestStatus.COMPLETED) {
      updateData.completedAt = completedAt ? new Date(completedAt) : new Date();
    }
    
    const updatedLabTest = await db.labTest.update({
      where: { id: testId },
      data: updateData,      include: {
        patient: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    return res.status(200).json({
      data: updatedLabTest,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}

/**
 * Assigne un technicien à un test de laboratoire
 */
export async function assignLabTest(
  req: Request,
  res: Response
) {
  const { technicianId, testId } = req.params;
  
  try {
    const technician = await db.labTechnician.findUnique({
      where: { id: technicianId }
    });
    
    if (!technician) {
      return res.status(404).json({
        data: null,
        error: "Technicien de laboratoire non trouvé"
      });
    }
    
    const labTest = await db.labTest.findUnique({
      where: { id: testId }
    });
    
    if (!labTest) {
      return res.status(404).json({
        data: null,
        error: "Test de laboratoire non trouvé"
      });
    }
    
    const updatedLabTest = await db.labTest.update({
      where: { id: testId },
      data: {
        technicianId,
        status: LabTestStatus.IN_PROGRESS
      }
    });
    
    return res.status(200).json({
      data: updatedLabTest,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}