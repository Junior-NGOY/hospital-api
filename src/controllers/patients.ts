import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { MedicalHistoryProps, PatientAllergyProps, PatientCreateProps, PatientToQueueProps, PatientUpdateProps, TypedRequestBody } from "@/types";
import { calculateAge } from "@/utils/calculateAge";
//import { parse } from 'csv-parse';
import { convertDateToIso } from "@/utils/convertDateToIso";
import { normalizePatientCategory } from "@/utils/mutuelle";
import { Request, Response } from "express";

/**
 * Hospital scope from JWT, with DB fallback for tokens issued before P0.3
 * (no hospitalId claim). Never trust client-supplied hospitalId.
 */
async function resolveHospitalScope(req: AuthRequest): Promise<{
  hospitalId: string | null;
  branchId: string | null;
}> {
  const fromToken = req.user?.hospitalId ?? null;
  const branchFromToken = req.user?.branchId ?? null;
  if (fromToken) {
    return { hospitalId: fromToken, branchId: branchFromToken };
  }
  const userId = req.user?.userId;
  if (!userId) {
    return { hospitalId: null, branchId: null };
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { hospitalId: true, branchId: true },
  });
  return {
    hospitalId: user?.hospitalId ?? null,
    branchId: user?.branchId ?? branchFromToken,
  };
}

function denyIfWrongHospital(
  patient: { hospitalId: string | null },
  hospitalId: string | null,
  res: Response
): boolean {
  if (!hospitalId || patient.hospitalId !== hospitalId) {
    res.status(403).json({
      data: null,
      error: "Accès refusé",
    });
    return true;
  }
  return false;
}

 export async function getNextPatientSequence(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const lastPatient = await db.patient.findFirst({
      where: hospitalId ? { hospitalId } : { id: "__none__" },
      orderBy: {
        createdAt: "desc"
      }
    });
    //BU/UG/2024/0001
    //HOPE/IND/2025/0001
    const stringSeq = lastPatient?.fileNumber?.split("/")[3];
    const lastSeq = stringSeq ? parseInt(stringSeq) : 0;
    const nextSeq = lastSeq + 1;
    return res.status(200).json(nextSeq);
  } catch (error) {
    console.log(error);
  }
} 

/**
 * Crée un nouveau patient dans le système
 */
export async function createPatient(
  req: AuthRequest & TypedRequestBody<PatientCreateProps & Record<string, unknown>>,
  res: Response
) {
  const data = req.body;
  const body = data as PatientCreateProps & {
    regNo?: string;
    phoneNumber?: string;
    maritalStatut?: string;
    insuranceName?: string;
    insuranceNumber?: string;
    affiliateNumber?: string;
  };

  try {
    const { hospitalId, branchId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return res.status(400).json({
        data: null,
        error: "Aucun hôpital associé au compte. Impossible de créer un patient.",
      });
    }
    const fileNumber =
      body.fileNumber || body.regNo || `HOPE/IND/${new Date().getFullYear()}/0001`;
    const phone = body.phone || body.phoneNumber || null;
    const maritalStatus =
      body.maritalStatus ||
      (body.maritalStatut as PatientCreateProps["maritalStatus"]) ||
      undefined;
    const firstName = body.firstName || body.name?.split(" ")[0] || "Patient";
    const lastName =
      body.lastName || body.name?.split(" ").slice(1).join(" ") || firstName;
    const name = body.name || `${firstName} ${lastName}`.trim();
    const category = normalizePatientCategory(body.category);
    const insuranceName =
      typeof body.insuranceName === "string" ? body.insuranceName.trim() || null : null;
    const insuranceNumber =
      typeof body.insuranceNumber === "string"
        ? body.insuranceNumber.trim() || null
        : typeof body.affiliateNumber === "string"
          ? body.affiliateNumber.trim() || null
          : null;

    const existingPatient = await db.patient.findUnique({
      where: { fileNumber },
    });

    if (existingPatient) {
      return res.status(409).json({
        data: null,
        error: "Un patient avec ce numéro de dossier existe déjà",
      });
    }

    const patient = await db.patient.create({
      data: {
        fileNumber,
        hospitalId,
        branchId: branchId || undefined,
        title: body.title,
        name,
        firstName,
        lastName,
        dateOfBirth: new Date(body.dateOfBirth),
        gender: body.gender,
        address: body.address,
        admissionDate: body.admissionDate
          ? (() => {
              try {
                return convertDateToIso(
                  String(body.admissionDate).slice(0, 10)
                );
              } catch {
                return new Date(body.admissionDate);
              }
            })()
          : new Date(),
        maritalStatus,
        nationality: body.nationality,
        profession: body.profession,
        phone,
        email: body.email,
        bloodType: body.bloodType,
        emergencyContact: body.emergencyContact,
        category,
        insuranceName,
        insuranceNumber,
      },
    });

    return res.status(201).json({
      data: patient,
      error: null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong",
    });
  }
}

/**
 * Récupère les détails d'un patient spécifique par son ID ou fileNumber
 */
export async function getPatientById(req: AuthRequest, res: Response) {
  const patientId = (req.params.id || req.params.patientId) as string;
  
  try {
    const { hospitalId } = await resolveHospitalScope(req);

    // Récupérer le patient par id ou numéro de dossier
    let patient = await db.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      patient = await db.patient.findUnique({
        where: { fileNumber: patientId }
      });
    }
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient not found"
      });
    }

    if (denyIfWrongHospital(patient, hospitalId, res)) {
      return;
    }

    const resolvedPatientId = patient.id;
    
    // Récupérer les entrées récentes dans les files d'attente
    const recentQueueEntries = await db.queueEntry.findMany({
      where: { patientId: resolvedPatientId },
      include: {
        queue: true,
    /*     assignedTo: {
          select: {
            id: true,
            firstName: true,
            role: true
          }
        } */
      },
    //  orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    // Récupérer les consultations récentes
    const recentConsultations = await db.consultation.findMany({
      where: { patientId: resolvedPatientId },
      include: {
        doctor: {
          include: {
            user: true // Inclure l'utilisateur pour accéder à firstName, lastName
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    // Récupérer les allergies du patient
    const allergies = await db.patientAllergy.findMany({
      where: { patientId: resolvedPatientId },
     
    });
    
    // Récupérer l'historique médical
    const medicalHistories = await db.medicalHistory.findMany({
      where: { patientId: resolvedPatientId },
      //orderBy: { createdAt: 'desc' }
    });
    
    // Calculer l'âge du patient
    const age = calculateAge(patient.dateOfBirth);
    
    // Formater la réponse
    const responseData = {
      ...patient,
      age,      recentQueueEntries: recentQueueEntries.map(entry => ({
        id: entry.id,
        queueId: entry.queueId,
        queueName: entry.queue?.name || 'Queue inconnue',
        status: entry.status,
        priority: entry.priority,
        createdAt: entry.createdAt
      })),
      recentConsultations: recentConsultations.map(consultation => ({
        id: consultation.id,
        date: consultation.date,
        reason: "consultation.chiefComplaint",
        diagnosis: consultation.diagnosis,
        doctor: consultation.doctor ? {
          id: consultation.doctor.id,
          name: `${consultation.doctor.user.firstName} ${consultation.doctor.user.lastName}`
        } : null
      })),
      allergies: allergies.map(item => ({
        id: item.id,
        severity: item.severity,
        reaction: item.reaction,
        notes: item.notes
      })),
      medicalHistories: medicalHistories.map(history => ({
        id: history.id,
        condition: history.condition,
        date: history.createdAt,
        notes: history.notes
      }))
    };
    
    return res.status(200).json({
      data: responseData,
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
 * Met à jour les informations d'un patient existant
 */
export async function updatePatient(
  req: AuthRequest & TypedRequestBody<PatientUpdateProps & Record<string, unknown>>,
  res: Response
) {
  const patientId = (req.params.id || req.params.patientId) as string;
  const data = req.body as PatientUpdateProps & {
    phoneNumber?: string;
    regNo?: string;
    title?: string;
    name?: string;
    nationality?: string;
    profession?: string;
    maritalStatus?: string;
    admissionDate?: string;
    affiliateNumber?: string;
  };
  
  try {
    const { hospitalId } = await resolveHospitalScope(req);

    // Vérifier si le patient existe
    const existingPatient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!existingPatient) {
      return res.status(404).json({
        data: null,
        error: "Patient not found"
      });
    }

    if (denyIfWrongHospital(existingPatient, hospitalId, res)) {
      return;
    }

    const fileNumber = data.fileNumber || data.regNo;
    const phone = data.phone !== undefined ? data.phone : data.phoneNumber;
    
    // Vérifier si le numéro de dossier est déjà utilisé par un autre patient
    if (fileNumber && fileNumber !== existingPatient.fileNumber) {
      const patientWithFileNumber = await db.patient.findUnique({
        where: { fileNumber }
      });
      
      if (patientWithFileNumber && patientWithFileNumber.id !== patientId) {
        return res.status(409).json({
          data: null,
          error: "Un autre patient utilise déjà ce numéro de dossier"
        });
      }
    }
    
    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {};
    
    if (fileNumber !== undefined) updateData.fileNumber = fileNumber;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.address !== undefined) updateData.address = data.address;
    if (phone !== undefined) updateData.phone = phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.bloodType !== undefined) updateData.bloodType = data.bloodType;
    if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact;
    if (data.category !== undefined) {
      updateData.category = normalizePatientCategory(data.category);
    }
    if (data.insuranceName !== undefined) {
      updateData.insuranceName =
        typeof data.insuranceName === "string" ? data.insuranceName.trim() || null : null;
    }
    if (data.insuranceNumber !== undefined || data.affiliateNumber !== undefined) {
      const raw =
        data.insuranceNumber !== undefined ? data.insuranceNumber : data.affiliateNumber;
      updateData.insuranceNumber = typeof raw === "string" ? raw.trim() || null : null;
    }
    if (data.nationality !== undefined) updateData.nationality = data.nationality;
    if (data.profession !== undefined) updateData.profession = data.profession;
    if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus;
    if (data.admissionDate !== undefined) {
      try {
        updateData.admissionDate = convertDateToIso(
          String(data.admissionDate).slice(0, 10)
        );
      } catch {
        updateData.admissionDate = new Date(data.admissionDate);
      }
    }
    
    // Mettre à jour le patient
    const updatedPatient = await db.patient.update({
      where: { id: patientId },
      data: updateData
    });
    
    // Calculer l'âge du patient
    const age = calculateAge(updatedPatient.dateOfBirth);
    
    return res.status(200).json({
      data: {
        ...updatedPatient,
        age
      },
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
 * Recherche des patients selon différents critères
 */
export async function searchPatients(req: AuthRequest, res: Response) {
  const { 
    query, 
    fileNumber,
    gender, 
    minAge, 
    maxAge, 
    category,
    bloodType,
    page = '1', 
    limit = '10' 
  } = req.query;
  
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return res.status(200).json({
        data: {
          patients: [],
          pagination: { total: 0, page: 1, limit: 10, totalPages: 0 }
        },
        error: null
      });
    }

    // Convertir les paramètres de pagination
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;
    
    // Construire les conditions de recherche
    const where: any = { hospitalId };
    
    // Recherche par numéro de dossier
    if (fileNumber) {
      where.fileNumber = { contains: fileNumber as string };
    }
    
    // Recherche par nom, prénom, email ou téléphone
    if (query) {
      where.OR = [
        { firstName: { contains: query as string, mode: 'insensitive' } },
        { lastName: { contains: query as string, mode: 'insensitive' } },
        { email: { contains: query as string, mode: 'insensitive' } },
        { phone: { contains: query as string } },
        { address: { contains: query as string, mode: 'insensitive' } }
      ];
    }
    
    // Filtrer par genre
    if (gender) {
      where.gender = gender;
    }
    
    // Filtrer par catégorie
    if (category) {
      where.category = category;
    }
    
    // Filtrer par groupe sanguin
    if (bloodType) {
      where.bloodType = bloodType;
    }
    
    // Filtrer par âge (calcul approximatif basé sur la date de naissance)
    if (minAge || maxAge) {
      const today = new Date();
      
      if (minAge) {
        const minBirthYear = today.getFullYear() - parseInt(minAge as string, 10);
        where.dateOfBirth = {
          ...(where.dateOfBirth || {}),
          lte: new Date(minBirthYear, today.getMonth(), today.getDate())
        };
      }
      
      if (maxAge) {
        const maxBirthYear = today.getFullYear() - parseInt(maxAge as string, 10);
        where.dateOfBirth = {
          ...(where.dateOfBirth || {}),
          gte: new Date(maxBirthYear, today.getMonth(), today.getDate())
        };
      }
    }
    
    // Compter le nombre total de résultats
    const totalCount = await db.patient.count({ where });
    
    // Récupérer les patients
    const patients = await db.patient.findMany({
      where,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ],
      skip,
      take: limitNumber
    });
    
    // Calculer l'âge pour chaque patient
    const patientsWithAge = patients.map(patient => ({
      ...patient,
      age: calculateAge(patient.dateOfBirth)
    }));
    
    // Calculer les informations de pagination
    const totalPages = Math.ceil(totalCount / limitNumber);
    
    return res.status(200).json({
      data: {
        patients: patientsWithAge,
        pagination: {
          total: totalCount,
          page: pageNumber,
          limit: limitNumber,
          totalPages
        }
      },
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
 * Supprime un patient du système
 * Note: Dans un système médical réel, il est souvent préférable de désactiver un patient plutôt que de le supprimer
 */
export async function deletePatient(req: AuthRequest, res: Response) {
  const patientId = (req.params.id || req.params.patientId) as string;
  
  try {
    const { hospitalId } = await resolveHospitalScope(req);

    // Vérifier si le patient existe
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient not found"
      });
    }

    if (denyIfWrongHospital(patient, hospitalId, res)) {
      return;
    }
    
    // Vérifier si le patient a des entrées dans les files d'attente
    const queueEntries = await db.queueEntry.findMany({
      where: { patientId }
    });
    
    if (queueEntries.length > 0) {
      return res.status(409).json({
        data: null,
        error: "Ce patient ne peut pas être supprimé car il a des entrées dans les files d'attente"
      });
    }
    
    // Supprimer le patient
    await db.patient.delete({
      where: { id: patientId }
    });
    
    return res.status(200).json({
      data: {
        message: "Patient supprimé avec succès",
        id: patientId
      },
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
 * Récupère l'historique médical complet d'un patient
 */
export async function getPatientMedicalHistory(req: Request, res: Response) {
  const { patientId } = req.params;
  
  try {
    // Vérifier si le patient existe
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient not found"
      });
    }
    
    // Récupérer les consultations
    const consultations = await db.consultation.findMany({
      where: { patientId },
      include: {
        doctor: {
          include: {
            user: true
          }
        },
        hospital: true,
        branch: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Récupérer les prescriptions avec les médicaments
    const prescriptions = await db.prescription.findMany({
      where: { patientId },
      include: {
        doctor: {
          include: {
            user: true
          }
        },
        medications: {
          include: {
            medication: true // Inclure la relation medication pour accéder au nom
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
 
    
    // Récupérer les signes vitaux
    const vitalSigns = await db.vitalSign.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' }
    });
    
    // Récupérer les allergies
    const allergies = await db.patientAllergy.findMany({
      where: { patientId }
    });
    
    // Récupérer l'historique médical
    const medicalHistories = await db.medicalHistory.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Récupérer les vaccinations
    const vaccinations = await db.vaccination.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Récupérer les chirurgies
    const surgeries = await db.surgery.findMany({
      where: { patientId },
      include: {
        primarySurgeon: {
          include: {
            user: true
          }
        },
        hospital: true,
        branch: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Formater la réponse
    const responseData = {
      patient: {
        id: patient.id,
        fileNumber: patient.fileNumber,
        firstName: patient.firstName,
        lastName: patient.lastName,
        fullName: `${patient.firstName} ${patient.lastName}`,
        dateOfBirth: patient.dateOfBirth,
        age: calculateAge(patient.dateOfBirth),
        gender: patient.gender,
        bloodType: patient.bloodType,
        category: patient.category
      },
      consultations: consultations.map(consultation => ({
        id: consultation.id,
        date: consultation.date,
        createdAt: consultation.createdAt,
        chiefComplaint: "consultation.chiefComplaint",
        symptoms: consultation.symptoms,
        diagnosis: consultation.diagnosis,
        notes: consultation.notes,
        followUpNeeded: consultation.followUpNeeded,
        followUpDate: consultation.followUpDate,
        doctor: consultation.doctor ? {
          id: consultation.doctor.id,
          name: `${consultation.doctor.user.firstName} ${consultation.doctor.user.lastName}`
        } : null,
        hospital: consultation.hospital ? {
          id: consultation.hospital.id,
          name: consultation.hospital.name
        } : null,
        branch: consultation.branch ? {
          id: consultation.branch.id,
          name: consultation.branch.name
        } : null
      })),
      // Mise à jour de la section des prescriptions
      prescriptions: prescriptions.map(prescription => ({
        id: prescription.id,
        createdAt: prescription.createdAt,
        doctor: prescription.doctor ? {
          id: prescription.doctor.id,
          name: `${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}`
        } : null,
        medications: prescription.medications.map(med => ({
          id: med.id,
          // Utiliser le nom du médicament via la relation medication
          name: med.medication ? med.medication.name : "Médicament inconnu",
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions
        }))
      })),
     /*  labTests: labTests.map(test => ({
        id: test.id,
        createdAt: test.createdAt,
        testType: test.testType,
        results: test.results,
        //normalRange: test.normalRange,
        status: test.status
      })), */      vitalSigns: vitalSigns.map(vs => ({
        id: vs.id,
        recordedAt: vs.recordedAt,
        temperature: vs.temperature,
        heartRate: vs.fc,
        bloodPressureSystolic: vs.pas,
        bloodPressureDiastolic: vs.pad,
        respirationRate: vs.respirationRate,
        weight: vs.weight,
        height: vs.height
      })),
      allergies: allergies.map(allergy => ({
        id: allergy.id,
        severity: allergy.severity,
        reaction: allergy.reaction,
        notes: allergy.notes
      })),
      medicalHistories: medicalHistories.map(history => ({
        id: history.id,
        condition: history.condition,
        createdAt: history.createdAt,
        notes: history.notes
      })),
      vaccinations: vaccinations.map(vaccination => ({
        id: vaccination.id,
        vaccine: vaccination.vaccine,
        createdAt: vaccination.createdAt,
        doseNumber: vaccination.doseNumber,
        //nextDoseDate: vaccination.nextDoseDate
      })),
      surgeries: surgeries.map(surgery => ({
        id: surgery.id,
        surgeryType: surgery.surgeryType,
        scheduledStart: surgery.scheduledStart,
        actualStart: surgery.actualStart,
        actualEnd: surgery.actualEnd,
        status: surgery.status,
        preOpDiagnosis: surgery.preOpDiagnosis,
        postOpDiagnosis: surgery.postOpDiagnosis,
        complications: surgery.complications,
        notes: surgery.notes,
        createdAt: surgery.createdAt,
        primarySurgeon: surgery.primarySurgeon ? {
          id: surgery.primarySurgeon.id,
          name: `${surgery.primarySurgeon.user.firstName} ${surgery.primarySurgeon.user.lastName}`
        } : null,
        hospital: surgery.hospital ? {
          id: surgery.hospital.id,
          name: surgery.hospital.name
        } : null,
        branch: surgery.branch ? {
          id: surgery.branch.id,
          name: surgery.branch.name
        } : null
      }))
    };
    
    return res.status(200).json({
      data: responseData,
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
 * Ajoute un patient à une file d'attente spécifique
 */
export async function addPatientToQueue(
  req: TypedRequestBody<PatientToQueueProps>,
  res: Response
) {
  const { patientId } = req.params;
  const { queueId, priority, notes } = req.body;
  
  try {
    // Vérifier si le patient existe
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient not found"
      });
    }
    
    // Vérifier si la file d'attente existe et est active
    const queue = await db.queue.findUnique({
      where: { id: queueId }
    });
    
    if (!queue) {
      return res.status(404).json({
        data: null,
        error: "Queue not found"
      });
    }
    
    if (!queue.isActive) {
      return res.status(400).json({
        data: null,
        error: "Queue is not active"
      });
    }
    
    // Vérifier si le patient est déjà dans la file d'attente avec un statut actif
    const existingEntry = await db.queueEntry.findFirst({
      where: {
        patientId,
        queueId,
        status: {
          in: ['WAITING', 'IN_PROGRESS']
        }
      }
    });
    
    if (existingEntry) {
      return res.status(409).json({
        data: null,
        error: "Patient already in queue"
      });
    }
    
    // Trouver le prochain numéro de ticket
    const maxTicket = await db.queueEntry.findFirst({
      where: { queueId },
      orderBy: { ticketNumber: 'desc' }    });
    
    const ticketNumber = maxTicket ? (maxTicket.ticketNumber || 0) + 1 : 1;
    
    // Créer l'entrée dans la file d'attente
    const queueEntry = await db.queueEntry.create({
      data: {
        queueId,
        patientId,
        status: 'WAITING',
        priority: priority || 'NORMAL',
        notes,
        ticketNumber
      },
      include: {
        patient: true,
        queue: true
      }
    });
    
    // Formater la réponse
    const responseData = {
      id: queueEntry.id,
      ticketNumber: queueEntry.ticketNumber,
      status: queueEntry.status,
      priority: queueEntry.priority,
      createdAt: queueEntry.createdAt,
      patient: {
        id: queueEntry.patient.id,
        fileNumber: queueEntry.patient.fileNumber,
        name: `${queueEntry.patient.firstName} ${queueEntry.patient.lastName}`,
        gender: queueEntry.patient.gender,
        age: calculateAge(queueEntry.patient.dateOfBirth)
      },
      queue: {        id: queueEntry.queue?.id || '',
        name: queueEntry.queue?.name || 'Queue inconnue'
      },
      notes: queueEntry.notes
    };
    
    return res.status(201).json({
      data: responseData,
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
 * Ajoute une allergie à un patient
 */
export async function addPatientAllergy(
  req: TypedRequestBody<PatientAllergyProps>,
  res: Response
) {
  const { patientId } = req.params;
  const { allergen, allergenType, severity, reaction, diagnosedDate, notes } = req.body;
  
  try {
    // Vérifier si le patient existe
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient not found"
      });
    }    
    // Vérifier si cette allergie est déjà enregistrée pour ce patient
    const existingAllergy = await db.patientAllergy.findFirst({
      where: {
        patientId,
        allergen
      }
    });

    if (existingAllergy) {
      return res.status(409).json({
        data: null,
        error: "This allergy is already registered for this patient"
      });
    }

    // Ajouter l'allergie au patient
    const patientAllergy = await db.patientAllergy.create({
      data: {
        patientId,
        allergen,
        severity,
        reaction,
        diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : undefined,
        notes,
        isActive: true
      }
    });

    return res.status(201).json({
      data: {
        id: patientAllergy.id,
        allergen: patientAllergy.allergen,
        severity: patientAllergy.severity,
        reaction: patientAllergy.reaction,
        diagnosedDate: patientAllergy.diagnosedDate,
        notes: patientAllergy.notes,
        isActive: patientAllergy.isActive
      },
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
 * Ajoute un antécédent médical à un patient
 */
export async function addMedicalHistory(
  req: TypedRequestBody<MedicalHistoryProps>,
  res: Response
) {
  const { patientId } = req.params;
  const { condition, diagnosedDate, notes } = req.body;
  
  try {
    // Vérifier si le patient existe
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient not found"
      });
    }    
    // Vérifier si cet antécédent est déjà enregistré pour ce patient
    const existingCondition = await db.medicalHistory.findFirst({
      where: {
        patientId,
        condition
      }
    });

    if (existingCondition) {
      return res.status(409).json({
        data: null,
        error: "This medical condition is already registered for this patient"
      });
    }

    // Ajouter l'antécédent médical au patient
    const medicalHistory = await db.medicalHistory.create({
      data: {
        patientId,
        condition,
        diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : new Date(),        notes
      }
    });
    
    return res.status(201).json({
      data: {
        id: medicalHistory.id,
        condition: medicalHistory.condition,
        diagnosedDate: medicalHistory.diagnosedDate,
        notes: medicalHistory.notes
      },
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
 * Récupère les patients récemment ajoutés au système
 */
export async function getRecentPatients(req: AuthRequest, res: Response) {
  const { limit = '10' } = req.query;
  
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return res.status(200).json({
        data: [],
        error: null
      });
    }

    const limitNumber = parseInt(limit as string, 10);
    
    // Récupérer les patients récemment ajoutés
    const recentPatients = await db.patient.findMany({
      where: { hospitalId },
      orderBy: { createdAt: 'desc' },
      take: limitNumber
    });
    
    // Calculer l'âge pour chaque patient
    const patientsWithAge = recentPatients.map(patient => ({
      ...patient,
      age: patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null
    }));
    
    return res.status(200).json({
      data: patientsWithAge,
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
 * Récupère tous les patients avec pagination et filtres optionnels
 */
export async function getPatients(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return res.status(200).json({
        data: [],
        error: null
      });
    }

    const patients = await db.patient.findMany({
      where: { hospitalId },
      orderBy: { 
         createdAt: "desc"
      },
      include: {
        _count: {
          select: {
            consultations: true,
            prescriptions: true,
           // labTests: true,
            allergies: true,
            medicalHistories: true
          }
        }
      }
    });
    
    const patientsWithAge = patients.map(patient => ({
      ...patient,
      age: calculateAge(patient.dateOfBirth)
    }));
    
    return res.status(200).json({
      data: patientsWithAge,
      error: null
    });
 
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    console.error(
      "Error fetching patients:",
      prismaCode ? `[${prismaCode}] ${message}` : message
    );
    return res.status(500).json({
      data: null,
      error: "Failed to fetch patients"
    });
  }
}

/**
 * Importe des patients à partir d'un fichier CSV
 */
/* export async function importPatients(req: Request, res: Response) {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({
        data: null,
        error: "No file uploaded"
      });
    }

    const fileBuffer = file.buffer;
    const fileContent = fileBuffer.toString('utf-8');
    
    // Utiliser csv-parser pour traiter le fichier
    const results: any[] = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    parser.on('readable', function() {
      let record;
      while (record = parser.read()) {
        results.push(record);
      }
    });
    
    // Attendre que le parsing soit terminé
    await new Promise<void>((resolve, reject) => {
      parser.on('error', (error:unknown) => reject(error));
      parser.on('end', () => resolve());
      parser.write(fileContent);
      parser.end();
    });
    
    // Traiter les données et les insérer dans la base de données
    const importedPatients = [];
    const errors = [];
    
    for (const [index, patientData] of results.entries()) {
      try {
        // Formater les données selon le modèle Patient
        const formattedData = {
          firstName: patientData.firstName || patientData.first_name || '',
          lastName: patientData.lastName || patientData.last_name || '',
          dateOfBirth: patientData.dateOfBirth || patientData.date_of_birth 
            ? new Date(patientData.dateOfBirth || patientData.date_of_birth) 
            : null,
          gender: patientData.gender || 'OTHER',
          email: patientData.email || null,
          phone: patientData.phone || null,
          address: patientData.address || null,
          city: patientData.city || null,
          postalCode: patientData.postalCode || patientData.postal_code || null,
          country: patientData.country || null,
          insuranceProvider: patientData.insuranceProvider || patientData.insurance_provider || null,
          insuranceNumber: patientData.insuranceNumber || patientData.insurance_number || null,
          emergencyContactName: patientData.emergencyContactName || patientData.emergency_contact_name || null,
          emergencyContactPhone: patientData.emergencyContactPhone || patientData.emergency_contact_phone || null,
          bloodType: patientData.bloodType || patientData.blood_type || null,
          occupation: patientData.occupation || null,
          maritalStatus: patientData.maritalStatus || patientData.marital_status || null,
          preferredLanguage: patientData.preferredLanguage || patientData.preferred_language || null,
          notes: patientData.notes || null
        };
        
        // Vérifier si le patient existe déjà (par email ou combinaison nom/prénom/date de naissance)
        const existingPatient = await db.patient.findFirst({
          where: {
            OR: [
              { email: formattedData.email },
              {
                AND: [
                  { firstName: formattedData.firstName },
                  { lastName: formattedData.lastName },
                  { dateOfBirth: formattedData.dateOfBirth  }
                ]
              }
            ]
          }
        });
        
        if (existingPatient) {
          // Mettre à jour le patient existant
          const updatedPatient = await db.patient.update({
            where: { id: existingPatient.id },
            data: formattedData
          });
          importedPatients.push({
            id: updatedPatient.id,
            action: 'updated'
          });
        } else {
          // Créer un nouveau patient
          const newPatient = await db.patient.create({
            data: formattedData
          });
          importedPatients.push({
            id: newPatient.id,
            action: 'created'
          });
        }
      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error);
        errors.push({
          row: index + 1,
          data: patientData,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    return res.status(200).json({
      data: {
        imported: importedPatients.length,
        errors: errors.length,
        details: {
          successful: importedPatients,
          failed: errors
        }
      },
      error: null
    });
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({
      data: null,
      error: "Failed to import patients: " + (error.message || 'Unknown error')
    });
  }
} */