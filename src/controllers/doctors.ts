import { db } from "@/db/db";
import { TypedRequestBody } from "@/types";
import { Request, Response } from "express";

/**
 * Récupère les consultations d'un médecin
 */
export async function getDoctorConsultations(req: Request, res: Response) {
  const { doctorId } = req.params;
  const { date, status } = req.query;
  
  try {
    const doctor = await db.doctor.findUnique({
      where: { id: doctorId }
    });
    
    if (!doctor) {
      return res.status(404).json({
        data: null,
        error: "Médecin non trouvé"
      });
    }
    
    let whereClause: any = { doctorId };
    
    // Filtrer par date si spécifiée
    if (date) {
      const queryDate = new Date(date as string);
      whereClause.date = {
        gte: new Date(queryDate.setHours(0, 0, 0, 0)),
        lt: new Date(queryDate.setHours(23, 59, 59, 999))
      };
    }
    
    const consultations = await db.consultation.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            fileNumber: true
          }
        },
        appointment: true,
        vitalSigns: {
          orderBy: {
            recordedAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    return res.status(200).json({
      data: consultations,
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
 * Récupère les rendez-vous d'un médecin
 */
export async function getDoctorAppointments(req: Request, res: Response) {
  const { doctorId } = req.params;
  const { date, status } = req.query;
  
  try {
    const doctor = await db.doctor.findUnique({
      where: { id: doctorId }
    });
    
    if (!doctor) {
      return res.status(404).json({
        data: null,
        error: "Médecin non trouvé"
      });
    }
    
    let whereClause: any = { doctorId };
    
    // Filtrer par date si spécifiée
    if (date) {
      const queryDate = new Date(date as string);
      whereClause.scheduledDate = {
        gte: new Date(queryDate.setHours(0, 0, 0, 0)),
        lt: new Date(queryDate.setHours(23, 59, 59, 999))
      };
    }
    
    // Filtrer par statut si spécifié
    if (status) {
      whereClause.status = status;
    }
    
    const appointments = await db.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            fileNumber: true
          }
        }
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    });
    
    return res.status(200).json({
      data: appointments,
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
 * Crée une nouvelle consultation
 */
interface ConsultationCreateProps {
  patientId: string;
  appointmentId?: string;
  chiefComplaint: string;
  symptoms?: string;
  diagnosis?: string;
  notes?: string;
  followUpNeeded?: boolean;
  followUpDate?: string;
}

export async function createConsultation(
  req: TypedRequestBody<ConsultationCreateProps>,
  res: Response
) {
  const { doctorId } = req.params;
  const { 
    patientId, 
    appointmentId, 
    chiefComplaint, 
    symptoms, 
    diagnosis, 
    notes, 
    followUpNeeded, 
    followUpDate 
  } = req.body;
  
  try {
    const doctor = await db.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true
      }
    });
    
    if (!doctor) {
      return res.status(404).json({
        data: null,
        error: "Médecin non trouvé"
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
    
    // Vérifier si le rendez-vous existe si un ID est fourni
    if (appointmentId) {
      const appointment = await db.appointment.findUnique({
        where: { id: appointmentId }
      });
      
      if (!appointment) {
        return res.status(404).json({
          data: null,
          error: "Rendez-vous non trouvé"
        });
      }
      
      // Mettre à jour le statut du rendez-vous
      await db.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' }
      });
    }
    
    // Créer la consultation
    const consultation = await db.consultation.create({
      data: {
        patientId,
        doctorId,
        appointmentId,
        //chiefComplaint,
        symptoms,
        diagnosis,
        notes,
        followUpNeeded: followUpNeeded || false,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        hospitalId: doctor.user.hospitalId,
        branchId: doctor.user.branchId
      }
    });
    
    // Créer un enregistrement d'accès au dossier patient
    await db.patientAccessLog.create({
      data: {
        patientId,
        userId: doctor.userId,
        accessType: 'CREATE',
        reason: 'Création d\'une consultation'
      }
    });
    
    return res.status(201).json({
      data: consultation,
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
 * Crée une nouvelle prescription
 */
interface MedicationItem {
  medicationId: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

interface PrescriptionCreateProps {
  patientId: string;
  consultationId?: string;
  notes?: string;
  medications: MedicationItem[];
}

export async function createPrescription(
  req: TypedRequestBody<PrescriptionCreateProps>,
  res: Response
) {
  const { doctorId } = req.params;
  const { patientId, consultationId, notes, medications } = req.body;
  
  try {
    const doctor = await db.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true
      }
    });
    
    if (!doctor) {
      return res.status(404).json({
        data: null,
        error: "Médecin non trouvé"
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
    
    // Vérifier si la consultation existe si un ID est fourni
    if (consultationId) {
      const consultation = await db.consultation.findUnique({
        where: { id: consultationId }
      });
      
      if (!consultation) {
        return res.status(404).json({
          data: null,
          error: "Consultation non trouvée"
        });
      }
    }
      // Créer la prescription avec les médicaments
    const prescription = await db.prescription.create({
      data: {
        patientId,
        doctorId,
        consultationId,
        notes,
        hospitalId: doctor.user.hospitalId || undefined,
        medications: {
          create: medications.map(med => ({
            medicationId: med.medicationId,
            dosage: med.dosage,
            frequency: med.frequency,
            duration: med.duration,
            instructions: med.instructions
          }))
        }
      },
      include: {
        medications: {
          include: {
            medication: true
          }
        }
      }
    });
    
    // Créer un enregistrement d'accès au dossier patient
    await db.patientAccessLog.create({
      data: {
        patientId,
        userId: doctor.userId,
        accessType: 'CREATE',
        reason: 'Création d\'une prescription'
      }
    });
    
    return res.status(201).json({
      data: prescription,
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
 * Demande un test de laboratoire
 */
interface LabTestRequestProps {
  patientId: string;
  testName: string;
  testType: string;
  scheduledAt?: string;
  notes?: string;
}

export async function requestLabTest(
  req: TypedRequestBody<LabTestRequestProps>,
  res: Response
) {
  const { doctorId } = req.params;
  const { patientId, testName, testType, scheduledAt, notes } = req.body;
  
  try {
    const doctor = await db.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true
      }
    });
    
    if (!doctor) {
      return res.status(404).json({
        data: null,
        error: "Médecin non trouvé"
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
      if (!doctor.user.hospitalId) {
      return res.status(400).json({
        data: null,
        error: "L'hôpital du docteur n'est pas défini"
      });
    }    // Créer la demande de test
    const labTest = await db.labTest.create({
      data: {
        patientId,
        doctorId,
        testName,
        testType,
        notes,
        status: 'PENDING',
        hospitalId: doctor.user.hospitalId
      }
    });
    
    return res.status(201).json({
      data: labTest,
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