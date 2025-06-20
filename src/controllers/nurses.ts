import { db } from "@/db/db";
import { TypedRequestBody } from "@/types";
import { Request, Response } from "express";
//import { AdministrationRoute } from "@prisma/client";

/**
 * Récupère les patients assignés à un infirmier
 */
export async function getNursePatients(req: Request, res: Response) {
  const { nurseId } = req.params;
  
  try {
    const nurse = await db.nurse.findUnique({
      where: { id: nurseId },
      include: {
        department: true
      }
    });
    
    if (!nurse) {
      return res.status(404).json({
        data: null,
        error: "Infirmier non trouvé"
      });
    }
    
    // Vérifier si l'infirmier est assigné à un département
    if (!nurse.departmentId) {
      return res.status(400).json({
        data: null,
        error: "L'infirmier n'est pas assigné à un département"
      });
    }
    
    // Récupérer les patients hospitalisés dans le département de l'infirmier
    const admissions = await db.admission.findMany({
      where: {
        status: 'ACTIVE',
        bed: {
          room: {
            departmentId: nurse.departmentId // Maintenant on est sûr que departmentId n'est pas null
          }
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            fileNumber: true,
            bloodType: true
          }
        },
        bed: {
          include: {
            room: true
          }
        },
        vitalSigns: {
          orderBy: {
            recordedAt: 'desc'
          },
          take: 1
        }
      }
    });
    
    return res.status(200).json({
      data: admissions,
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
 * Enregistre les signes vitaux d'un patient
 */
interface VitalSignsProps {
  patientId: string;
  admissionId?: string;
  consultationId?: string;
  temperature?: number;
  heartRate?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  pain?: number;
  notes?: string;
}

export async function recordVitalSigns(
  req: TypedRequestBody<VitalSignsProps>,
  res: Response
) {
  const { nurseId } = req.params;
  const {
    patientId,
    admissionId,
    consultationId,
    temperature,
    heartRate,
    bloodPressureSys,
    bloodPressureDia,
    respiratoryRate,
    oxygenSaturation,
    pain,
    notes
  } = req.body;
  
  try {
    const nurse = await db.nurse.findUnique({
      where: { id: nurseId }
    });
    
    if (!nurse) {
      return res.status(404).json({
        data: null,
        error: "Infirmier non trouvé"
      });
    }
    
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient non trouvé"
      });
    }
    
    // Créer l'enregistrement des signes vitaux
    const vitalSigns = await db.vitalSign.create({
      data: {
        patientId,
        nurseId,
        admissionId,
        consultationId,
        temperature,
        //heartRate,
        //bloodPressureSys,
        //bloodPressureDia,
        //respiratoryRate,
        //oxygenSaturation,
        //pain,
        notes
      }
    });
    
    // Créer un enregistrement d'accès au dossier patient
    await db.patientAccessLog.create({
      data: {
        patientId,
        userId: nurse.userId,
        accessType: 'CREATE',
       // reason: 'Enregistrement des signes vitaux'
      }
    });
    
    return res.status(201).json({
      data: vitalSigns,
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
 * Administre un médicament à un patient
 */
interface MedicationAdminProps {
  patientId: string;
  medicationId: string;
  admissionId?: string;
  dose: string;
  route?: string; // Si vous voulez l'utiliser plus tard
  notes?: string;
}

export async function administerMedication(
  req: TypedRequestBody<MedicationAdminProps>,
  res: Response
) {
  const { nurseId } = req.params;
  const { patientId, medicationId, admissionId, dose, route, notes } = req.body;
  
  try {
    const nurse = await db.nurse.findUnique({
      where: { id: nurseId }
    });
    
    if (!nurse) {
      return res.status(404).json({
        data: null,
        error: "Infirmier non trouvé"
      });
    }
    
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient non trouvé"
      });
    }
    
    const medication = await db.medication.findUnique({
      where: { id: medicationId }
    });
    
    if (!medication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé"
      });
    }    // Créer l'enregistrement d'administration de médicament
    const administration = await db.medicationAdministration.create({
      data: {
        patientId,
        nurseId,
        medication: medication.name, // Utiliser le nom du médicament depuis l'objet medication trouvé
        admissionId,
        dose,
        route,
        notes
      }
    });
    
    // Créer un enregistrement d'accès au dossier patient
    await db.patientAccessLog.create({
      data: {
        patientId,
        userId: nurse.userId,
        accessType: 'CREATE',
       // reason: 'Administration de médicament'
      }
    });
    
    return res.status(201).json({
      data: administration,
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