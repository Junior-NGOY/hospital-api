import { db } from "@/db/db";
import { TypedRequestBody } from "@/types";
import { Request, Response } from "express";
import { AppointmentStatus, Gender, QueuePriority } from "@prisma/client";

/**
 * Enregistre un nouveau patient
 */
interface PatientRegisterProps {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  address?: string;
  phone?: string;
  email?: string;
  bloodType?: string;
  emergencyContact?: string;
  category?: 'PRIVATE' | 'SUBSCRIBER';
  fileNumber?: string;
}

export async function registerPatient(
  req: TypedRequestBody<PatientRegisterProps>,
  res: Response
) {
  const data = req.body;
  const { userId } = req.params;
  
  try {
    const user = await db.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }
    
    // Vérifier si un patient avec le même numéro de dossier existe déjà
    if (data.fileNumber) {
      const existingPatient = await db.patient.findUnique({
        where: { fileNumber: data.fileNumber }
      });
      
      if (existingPatient) {
        return res.status(409).json({
          data: null,
          error: "Un patient avec ce numéro de dossier existe déjà"
        });
      }
    }
    
    // Générer un numéro de dossier si non fourni
    const fileNumber = data.fileNumber || `P${Date.now().toString().slice(-8)}`;
    // Créer le nouveau patient avec des valeurs non-nulles pour hospitalId et branchId
    const patientData: any = {
      fileNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      category: data.category || 'PRIVATE'
    };
   
    if (data.bloodType) {
      // Vérifier si la valeur est une valeur valide de BloodType
      // Cette vérification dépend de la façon dont BloodType est défini dans votre schéma
      patientData.bloodType = data.bloodType;
    }
    
    if (data.emergencyContact) patientData.emergencyContact = data.emergencyContact;
    
    // Ajouter hospitalId et branchId seulement s'ils sont définis dans l'utilisateur
    if (user.hospitalId) patientData.hospitalId = user.hospitalId;
    if (user.branchId) patientData.branchId = user.branchId;
    
    const patient = await db.patient.create({
      data: patientData
    });
    
    return res.status(201).json({
      data: patient,
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
 * Planifie un rendez-vous
 */
interface AppointmentScheduleProps {
  patientId: string;
  doctorId: string;
  scheduledDate: string;
  duration?: number;
  reason?: string;
  status?: AppointmentStatus;
  notes?: string;
}

export async function scheduleAppointment(
  req: TypedRequestBody<AppointmentScheduleProps>,
  res: Response
) {
  const { userId } = req.params;
  const {
    patientId,
    doctorId,
    scheduledDate,
    duration,
    reason,
    status,
    notes
  } = req.body;
  
  try {
    const user = await db.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
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
    
    const doctor = await db.doctor.findUnique({
      where: { id: doctorId }
    });
    
    if (!doctor) {
      return res.status(404).json({
        data: null,
        error: "Médecin non trouvé"
      });
    }
    
    // Vérifier les conflits d'horaire
    const scheduledDateTime = new Date(scheduledDate);
    const endTime = new Date(scheduledDateTime);
    endTime.setMinutes(endTime.getMinutes() + (duration || 30));
    
    const conflictingAppointment = await db.appointment.findFirst({
      where: {
        doctorId,
        scheduledDate: {
          gte: scheduledDateTime,
          lt: endTime
        },
        status: {
          notIn: ['CANCELLED', 'COMPLETED']
        }
      }
    });
    
    if (conflictingAppointment) {
      return res.status(409).json({
        data: null,
        error: "Le médecin a déjà un rendez-vous à cette heure"
      });
    }
    
    // Créer le rendez-vous
    const appointment = await db.appointment.create({
      data: {
        patientId,
        doctorId,
        scheduledDate: scheduledDateTime,
        duration: duration || 30,
        reason,
        status: status || 'SCHEDULED',
        notes,
        hospitalId: user.hospitalId,
        branchId: user.branchId
      }
    });
    
    return res.status(201).json({
      data: appointment,
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
 * Ajoute un patient à la file d'attente
 */
interface QueueEntryProps {
  patientId: string;
  queueId: string;
  priority?: QueuePriority;
  notes?: string;
}

export async function addToQueue(
  req: TypedRequestBody<QueueEntryProps>,
  res: Response
) {
  const { userId } = req.params;
  const { patientId, queueId, priority, notes } = req.body;
  
  try {
    const user = await db.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
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
    
    const queue = await db.queue.findUnique({
      where: { id: queueId }
    });
    
    if (!queue) {
      return res.status(404).json({
        data: null,
        error: "File d'attente non trouvée"
      });
    }
    
    // Vérifier si le patient est déjà dans la file d'attente
    const existingEntry = await db.queueEntry.findFirst({
      where: {
        patientId,
        queueId,
        status: {
          in: ['WAITING', 'IN_PROGRESS']
        }
      }    });
    
    if (existingEntry) {
      return res.status(409).json({
        data: null,
        error: "Le patient est déjà dans cette file d'attente"
      });
    }
    
    // Trouver le prochain numéro de ticket
    const maxTicket = await db.queueEntry.findFirst({
      where: { queueId },
      orderBy: { ticketNumber: 'desc' }
    });
    
    const ticketNumber = maxTicket ? (maxTicket.ticketNumber || 0) + 1 : 1;
    
    // Créer l'entrée dans la file d'attente sans hospitalId et branchId
    const queueEntryData: any = {
      queueId,
      patientId,
      status: 'WAITING', // Assurez-vous que c'est une valeur valide pour QueueEntryStatus
      priority: priority || 'NORMAL',
      ticketNumber
    };
    
    // Ajouter les notes si définies
    if (notes) queueEntryData.notes = notes;
    
    // Ne pas ajouter hospitalId et branchId car ils n'existent pas dans le modèle QueueEntry
    
    const queueEntry = await db.queueEntry.create({
      data: queueEntryData
    });
    
    return res.status(201).json({
      data: queueEntry,
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