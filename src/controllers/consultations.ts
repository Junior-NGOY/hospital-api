import { db } from "@/db/db";
import { Request, Response } from "express";
import { TypedRequestBody } from "@/types";
import { AuthRequest } from "@/middleware/auth";
import {
  jsonError,
  requirePatientInHospital,
  resolveHospitalScope,
} from "@/utils/hospitalScope";
import { syncConsultationToDme, ConsultationDmePayload } from "@/utils/syncConsultationToDme";
import { placeLabOrder, resolveDoctorUser } from "@/utils/labOrders";

async function denyIfConsultationOutOfScope(
  req: AuthRequest,
  res: Response,
  consultation: { hospitalId: string | null; patientId: string }
): Promise<boolean> {
  const { hospitalId } = await resolveHospitalScope(req);
  if (!hospitalId) {
    jsonError(res, 403, "Accès refusé");
    return true;
  }
  if (consultation.hospitalId && consultation.hospitalId !== hospitalId) {
    jsonError(res, 403, "Accès refusé");
    return true;
  }
  const patient = await db.patient.findUnique({
    where: { id: consultation.patientId },
    select: { hospitalId: true },
  });
  if (!patient || patient.hospitalId !== hospitalId) {
    jsonError(res, 403, "Accès refusé");
    return true;
  }
  return false;
}

function toFloat(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

function toInt(value: unknown): number | undefined {
  const n = toFloat(value);
  return n === undefined ? undefined : Math.round(n);
}

async function resolveDoctorId(raw?: string | null): Promise<string | undefined> {
  if (!raw) return undefined;
  const asDoctor = await db.doctor.findUnique({
    where: { id: raw },
    select: { id: true },
  });
  if (asDoctor) return asDoctor.id;
  const byUser = await db.doctor.findUnique({
    where: { userId: raw },
    select: { id: true },
  });
  return byUser?.id;
}

function extractPrescribedExams(data: CreateConsultationProps): Array<{
  name: string;
  category: string;
  priority?: string;
  instructions?: string;
}> {
  const para = data.paraclinicalExams as
    | {
        exams?: Array<{
          name?: string;
          category?: string;
          priority?: string;
          instructions?: string;
        }>;
        requestedExams?: Array<{
          name?: string;
          category?: string;
          priority?: string;
          instructions?: string;
        }>;
      }
    | undefined;
  const list = [...(para?.exams || []), ...(para?.requestedExams || [])];
  const seen = new Set<string>();
  const exams: Array<{
    name: string;
    category: string;
    priority?: string;
    instructions?: string;
  }> = [];
  for (const exam of list) {
    if (!exam?.name) continue;
    const name = String(exam.name).trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    exams.push({
      name,
      category: String(exam.category || "OTHER"),
      priority: exam.priority,
      instructions: exam.instructions,
    });
  }
  return exams;
}

// ==================== FONCTIONS POUR LES CONSULTATIONS ====================

export interface CreateConsultationProps {
  selectedPatient: {
    id: string;
    fileNumber: string;
  };  vitalSigns: {
    id: string;
    staffId: string;
    staff: any;
    recordedAt: string;
    temperature: string;
    respirationRate: string;
    height: string;
    weight: string;
    pa: string;
    ta: string;
    ddr: string;
    dpa: string;
    pc: string;
    imc: string;
    pas: string;
    pad: string;
    fc: string;
    spo2: string;
    notes: string;
  };
  currentIllness: {
    chiefComplaint: string;
    startDate: string;
    hma: string;
  };
  medicalHistory: {
    medicalEvents: Array<{
      id: string;
      type: string;
      description: string;
      year: string;
      treatment: string;
    }>;
    familyHistory: Array<{
      id: string;
      relationship: string;
      condition: string;
      age: string;
      status: string;
      notes: string;
    }>;
    lifestyle: {
      smoking: {
        status: string;
        quantity: string;
      };
      alcohol: {
        frequency: string;
        type: string;
      };
      diet: {
        type: string;
        restrictions: string;
      };
    };
    allergies: Array<{
      id: string;
      type: string;
      allergen: string;
      reaction: string;
      severity: string;
    }>;
    gynecologicalHistory: {
      menstrualHistory: string;
    };
  };
  additionalAnamnesis: {
    severity: string;
    symptoms: string;
    aggravatingFactors: string;
    relievingFactors: string;
    previousTreatments: string;
  };
  patientBackground: {
    conditions: Array<{
      id: string;
      name: string;
    }>;
    conditionDetails: string;
  };
  clinicalExams: {
    selectedOptions: {
      [key: string]: string[];
    };
  };
  diagnosis: {
    mainDiagnosis: string;
    secondaryDiagnoses: string[];
    differentialDiagnoses: string[];
    notes: string;
    certainty: string;
    severity: string;
  };
  paraclinicalExams: {
    requestedExams?: Array<{
      id: string;
      name: string;
      prescriptionDate: string;
      expectedDate: string;
      category: string;
      status: string;
      priority: string;
      facility: string;
      instructions: string;
    }>;
    exams?: Array<{
      id?: string;
      name?: string;
      category?: string;
      status?: string;
      priority?: string;
      instructions?: string;
    }>;
    paraclinicalConclusion: string;
  };
  treatment: {
    medications: Array<{
      id: string;
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      route: string;
      instructions: string;
      genericName?: string;
      form?: string;
      strength?: string;
      fabricant?: string;
      description?: string;
      stock?: number;
      unitPrice?: number;
      sellingPrice?: number;
      category?: any;
      supplier?: any;
      createdAt?: string;
    }>;
    nonPharmacological: string;
    treatmentPlan: string;
  };
  recommendations: {
    recommendations: any[];
    dietaryMeasures: string;
    physicalActivity: string;
    restrictions: string;
    followUp: string;
    additionalNotes: string;
  };
  certificate: {
    content: string;
  };
  metadata: {
    createdAt?: string;
    updatedAt?: string;
    status?: string;
  };
  // Add the following optional properties for consultation creation
  appointmentId?: string;
  hospitalId?: string;
  branchId?: string;
  symptoms?: string;
  notes?: string;
  followUpNeeded?: boolean;
  followUpDate?: string;
  consultationFee?: number;
  basePrice?: number;
  appliedPrice?: number;
  discountAmount?: number;
  subscriptionId?: string;
  doctorId?: string;
}

/**
 * Crée une nouvelle consultation médicale et alimente le DME (P0.4).
 */
export async function createConsultation(
  req: AuthRequest & TypedRequestBody<CreateConsultationProps>,
  res: Response
) {
  const data = req.body;

  try {
    const patientId = data?.selectedPatient?.id;
    if (!patientId) {
      return res.status(400).json({
        data: null,
        error: "Un patient est requis pour enregistrer la consultation",
      });
    }

    const patient = await db.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient non trouvé",
      });
    }

    const scoped = await requirePatientInHospital(req, res, patientId);
    if (!scoped) return;

    const doctorId = await resolveDoctorId(data.doctorId);
    const hospitalId = scoped.hospitalId;
    const branchId = scoped.branchId || patient.branchId || undefined;

    let chiefComplaintId: string | undefined;
    const rawComplaint = data.currentIllness?.chiefComplaint;
    if (rawComplaint) {
      const found = await db.chiefComplaint.findUnique({
        where: { id: rawComplaint },
        select: { id: true },
      });
      if (found) chiefComplaintId = found.id;
    }

    const diagnosis = data.diagnosis
      ? typeof data.diagnosis === "object"
        ? JSON.parse(JSON.stringify(data.diagnosis))
        : data.diagnosis
      : undefined;

    const symptoms =
      data.symptoms ||
      [
        data.currentIllness?.chiefComplaint,
        data.currentIllness?.hma,
        (data.currentIllness as { illnessDescription?: string } | undefined)?.illnessDescription,
        (data.currentIllness as { symptoms?: string } | undefined)?.symptoms,
      ]
        .filter(Boolean)
        .join("\n") || undefined;

    const newConsultation = await db.consultation.create({
      data: {
        patientId,
        doctorId,
        appointmentId: data.appointmentId,
        hospitalId,
        branchId,
        chiefComplaintId,
        diagnosis,
        symptoms,
        notes: data.notes,
        followUpNeeded: data.followUpNeeded || false,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
        consultationFee: data.consultationFee,
        basePrice: data.basePrice,
        appliedPrice: data.appliedPrice,
        discountAmount: data.discountAmount,
        subscriptionId: data.subscriptionId,
      },
    });

    if (data.vitalSigns) {
      let validNurseId: string | null = null;
      if (data.vitalSigns.staffId) {
        const nurse = await db.nurse.findUnique({
          where: { id: data.vitalSigns.staffId },
        });
        if (nurse) validNurseId = nurse.id;
      }

      const vs = data.vitalSigns as typeof data.vitalSigns & {
        bloodPressureSystolic?: string;
        bloodPressureDiastolic?: string;
        heartRate?: string;
        oxygenSaturation?: string;
        respiratoryRate?: string;
        bmi?: string;
      };
      const pas = vs.pas || vs.bloodPressureSystolic;
      const pad = vs.pad || vs.bloodPressureDiastolic;
      const fc = vs.fc || vs.heartRate;
      const spo2 = vs.spo2 || vs.oxygenSaturation;
      const respirationRate = vs.respirationRate || vs.respiratoryRate;
      const imc = vs.imc || vs.bmi;

      const hasAnyVital =
        toFloat(vs.temperature) !== undefined ||
        toInt(respirationRate) !== undefined ||
        toFloat(vs.height) !== undefined ||
        toFloat(vs.weight) !== undefined ||
        toFloat(pas) !== undefined ||
        toFloat(pad) !== undefined ||
        toFloat(fc) !== undefined ||
        toFloat(spo2) !== undefined ||
        Boolean(vs.ta) ||
        Boolean(vs.notes);

      if (hasAnyVital) {
        await db.vitalSign.create({
          data: {
            patientId,
            nurseId: validNurseId,
            consultationId: newConsultation.id,
            temperature: toFloat(vs.temperature),
            respirationRate: toInt(respirationRate),
            height: toFloat(vs.height),
            weight: toFloat(vs.weight),
            pa: toFloat(vs.pa),
            ta: vs.ta || undefined,
            ddr: vs.ddr || undefined,
            dpa: vs.dpa || undefined,
            pc: toFloat(vs.pc),
            imc: toFloat(imc),
            pas: toFloat(pas),
            pad: toFloat(pad),
            fc: toFloat(fc),
            spo2: toFloat(spo2),
            notes: vs.notes || undefined,
            recordedAt: vs.recordedAt ? new Date(vs.recordedAt) : new Date(),
          },
        });
      }
    }

    await syncConsultationToDme(patientId, data as ConsultationDmePayload, doctorId);

    const prescribedExams = extractPrescribedExams(data);
    if (prescribedExams.length > 0) {
      try {
        const doctorInfo = await resolveDoctorUser(doctorId);
        for (const exam of prescribedExams) {
          await placeLabOrder({
            hospitalId,
            patientId,
            consultationId: newConsultation.id,
            doctorUserId: doctorInfo.userId,
            doctorProfileId: doctorInfo.profileId || doctorId || null,
            testName: exam.name,
            testType: exam.category,
            urgency: exam.priority,
            notes: exam.instructions || null,
            instructions: exam.instructions || null,
            orderedByName: doctorInfo.name || "Médecin",
          });
        }
      } catch (labError) {
        console.error("lab orders from consultation", labError);
      }
    }

    return res.status(201).json({
      data: newConsultation,
      error: null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la création de la consultation",
    });
  }
}

/**
 * Récupère toutes les consultations avec filtres optionnels
 */
export async function getConsultations(req: AuthRequest, res: Response) {
  const { 
    patientId, 
    doctorId, 
    branchId, 
    startDate, 
    endDate, 
    isPaid,
    page = "1",
    limit = "20"
  } = req.query;

  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 20;

    if (!hospitalId) {
      return res.status(200).json({
        data: {
          consultations: [],
          pagination: {
            total: 0,
            page: pageNumber,
            limit: limitNumber,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
        error: null,
      });
    }

    const where: any = {
      OR: [{ hospitalId }, { patient: { hospitalId } }],
    };
    
    if (patientId) {
      where.patientId = patientId as string;
    }
    
    if (doctorId) {
      where.doctorId = doctorId as string;
    }
    
    if (branchId) {
      where.branchId = branchId as string;
    }
    
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    } else if (startDate) {
      where.date = {
        gte: new Date(startDate as string)
      };
    } else if (endDate) {
      where.date = {
        lte: new Date(endDate as string)
      };
    }
    
    if (isPaid !== undefined) {
      where.isPaid = isPaid === "true";
    }

    const skip = (pageNumber - 1) * limitNumber;

    // Récupérer les consultations avec pagination
    const [consultations, total] = await Promise.all([
      db.consultation.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limitNumber,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fileNumber: true
            }
          },
          doctor: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          appointment: {
            select: {
              id: true,
              scheduledDate: true,
              status: true
            }
          },
          hospital: {
            select: {
              id: true,
              name: true
            }
          },
          branch: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              prescriptions: true,
             // labTests: true,
              vitalSigns: true
            }
          }
        }
      }),
      db.consultation.count({ where })
    ]);

    // Calculer les informations de pagination
    const totalPages = Math.ceil(total / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    return res.status(200).json({
      data: {
        consultations,
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération des consultations"
    });
  }
}

/**
 * Récupère une consultation par son ID
 */
export async function getConsultationById(req: AuthRequest, res: Response) {
  const { id } = req.params;

  try {
    const consultation = await db.consultation.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fileNumber: true,
            dateOfBirth: true,
            gender: true,
            bloodType: true,
            allergies: true
          }
        },
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        appointment: true,
        hospital: {
          select: {
            id: true,
            name: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        prescriptions: {
          include: {
            medications: {
              include: {
                medication: true
              }
            }
          }
        },
       // labTests: true,
        vitalSigns: true,
        clinicalExamination: true,
        paraclinicalExam: true,
        //medicalRecord: true,
       /*  invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            status: true
          }
        } */
      }
    });

    if (!consultation) {
      return res.status(404).json({
        data: null,
        error: "Consultation non trouvée"
      });
    }

    if (await denyIfConsultationOutOfScope(req, res, consultation)) {
      return;
    }

    return res.status(200).json({
      data: consultation,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération de la consultation"
    });
  }
}

/**
 * Met à jour une consultation
 */
export async function updateConsultation(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const {
    chiefComplaint,
    symptoms,
    diagnosis,
    notes,
    followUpNeeded,
    followUpDate,
    consultationFee,
    isPaid,
    basePrice,
    appliedPrice,
    discountAmount
  } = req.body;

  try {
    // Vérifier si la consultation existe
    const consultation = await db.consultation.findUnique({
      where: { id }
    });

    if (!consultation) {
      return res.status(404).json({
        data: null,
        error: "Consultation non trouvée"
      });
    }

    if (await denyIfConsultationOutOfScope(req, res, consultation)) {
      return;
    }

    const updatedConsultation = await db.consultation.update({
      where: { id },
      data: {
        chiefComplaintId: chiefComplaint || undefined,
        // Remove symptoms as it doesn't exist in the model
        diagnosis: diagnosis !== undefined ? diagnosis : undefined,
        notes: notes !== undefined ? notes : undefined,
        followUpNeeded: followUpNeeded !== undefined ? followUpNeeded : undefined,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        consultationFee: consultationFee !== undefined ? consultationFee : undefined,
        // Remove isPaid as it doesn't exist in the model
        basePrice: basePrice !== undefined ? basePrice : undefined,
        appliedPrice: appliedPrice !== undefined ? appliedPrice : undefined,
        discountAmount: discountAmount !== undefined ? discountAmount : undefined
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            fileNumber: true
          }
        },
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    return res.status(200).json({
      data: updatedConsultation,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la mise à jour de la consultation"
    });
  }
}

/**
 * Supprime une consultation
 */
export async function deleteConsultation(req: AuthRequest, res: Response) {
  const { id } = req.params;

  try {
    // Vérifier si la consultation existe et compter les entités liées
    const [consultation, prescriptionsCount, labTestsCount, vitalSignsCount, clinicalExaminationCount] = await Promise.all([
      db.consultation.findUnique({
        where: { id }
      }),
      db.prescription.count({
        where: { consultationId: id }
      }),
     /*  db.labTest.count({
        where: { consultationId: id }
      }), */
      db.vitalSign.count({
        where: { consultationId: id }
      }),
      db.clinicalExamination.count({
        where: { consultationId: id }
      }),
      db.paraclinicalExam.count({
        where: { consultationId: id }
      })
    ]);

    if (!consultation) {
      return res.status(404).json({
        data: null,
        error: "Consultation non trouvée"
      });
    }

    if (await denyIfConsultationOutOfScope(req, res, consultation)) {
      return;
    }

    // Vérifier s'il y a des entités liées
    const hasRelatedEntities = 
      prescriptionsCount > 0 ||
      labTestsCount > 0 ||
      vitalSignsCount > 0 ||
      clinicalExaminationCount > 0 ||
     // paraclinicalExamCount > 0;

   /*  if (hasRelatedEntities) {
      return res.status(400).json({
        data: null,
        error: "Impossible de supprimer cette consultation car elle contient des prescriptions, des tests de laboratoire, des signes vitaux ou des examens"
      });
    } */

    // Si un rendez-vous est associé, le remettre à l'état CONFIRMED
  /*   if (consultation.appointmentId) {
      await db.appointment.update({
        where: { id: consultation.appointmentId },
        data: { status: "CONFIRMED" }
      });
    } */

    // Supprimer la consultation
    await db.consultation.delete({
      where: { id }
    });

    return res.status(200).json({
      data: { id },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la suppression de la consultation"
    });
  }
}

/**
 * Récupère l'historique des consultations d'un patient
 */
export async function getPatientConsultationHistory(req: Request, res: Response) {
  const { patientId } = req.params;
  const { limit = "10" } = req.query;

  try {
    // Vérifier si le patient existe
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient non trouvé"
      });
    }

    // Récupérer les consultations du patient
    const consultations = await db.consultation.findMany({
      where: { patientId },
      orderBy: { date: "desc" },
      take: parseInt(limit as string) || 10,
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        hospital: {
          select: {
            name: true
          }
        },
        branch: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            prescriptions: true,
            //labTests: true
          }
        }
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
      error: "Une erreur est survenue lors de la récupération de l'historique des consultations"
    });
  }
}

/**
 * Récupère les consultations d'un médecin pour une période donnée
 */
export async function getDoctorConsultations(req: Request, res: Response) {
  const { doctorId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    // Vérifier si le médecin existe
    const doctor = await db.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!doctor) {
      return res.status(404).json({
        data: null,
        error: "Médecin non trouvé"
      });
    }

    // Définir la période pour les consultations
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate as string) : new Date(new Date().setHours(23, 59, 59, 999));

    // Récupérer les consultations du médecin pour la période
    const consultations = await db.consultation.findMany({
      where: {
        doctorId,
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: { date: "asc" },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fileNumber: true
          }
        },
        appointment: {
          select: {
            scheduledDate: true
          }
        }
      }
    });

    // Calculer quelques statistiques
    const totalConsultations = consultations.length;
    const followUps = consultations.filter(c => c.followUpNeeded).length;
    const withPrescriptions = await db.prescription.count({
      where: {
        doctorId,
        consultationId: {
          in: consultations.map(c => c.id)
        }
      }
    });
/*     const withLabTests = await db.labTest.count({
      where: {
        consultationId: {
          in: consultations.map(c => c.id)
        }
      }
    }); */

    return res.status(200).json({
      data: {
        doctor: {
          id: doctor.id,
          name: `${doctor.user.firstName} ${doctor.user.lastName}`
        },
        period: {
          start,
          end
        },
        stats: {
          totalConsultations,
          followUps,
          withPrescriptions,
          //withLabTests
        },
        consultations
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération des consultations du médecin"
    });
  }
}

/**
 * Marque une consultation comme payée et crée une facture si nécessaire
 */
export async function markConsultationAsPaid(req: Request, res: Response) {
  const { id } = req.params;
  const { 
    paymentMethod, 
    paymentAmount, 
    createInvoice = true,
    accountantId
  } = req.body;

  try {
    // Vérifier si la consultation existe
    const consultation = await db.consultation.findUnique({
      where: { id }
    });

    if (!consultation) {
      return res.status(404).json({
        data: null,
        error: "Consultation non trouvée"
      });
    }

    // Récupérer les informations nécessaires
    const [patient, doctor, /* invoice */] = await Promise.all([
      db.patient.findUnique({
        where: { id: consultation.patientId }
      }),
      consultation.doctorId ? db.doctor.findUnique({
        where: { id: consultation.doctorId },
        include: {
          user: true
        }
      }) : null,
   /*    db.invoice.findFirst({
        where: { referenceId: id, referenceType: "Consultation" }
      }) */
    ]);

    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient non trouvé"
      });
    }

    // Vérifier si la consultation est déjà payée
    const isPaid = await db.invoice.findFirst({
      where: { 
       // referenceId: id, 
       // referenceType: "Consultation",
        status: "PAID"
      }
    }) !== null;

    if (isPaid) {
      return res.status(400).json({
        data: null,
        error: "Cette consultation est déjà marquée comme payée"
      });
    }

    // Déterminer le montant à payer
    const amountToPay = consultation.appliedPrice || consultation.consultationFee || 0;
    
    if (amountToPay <= 0) {
      return res.status(400).json({
        data: null,
        error: "Le montant de la consultation n'est pas défini"
      });
    }

    // Vérifier si le montant payé est suffisant
    if (paymentAmount < amountToPay) {
      return res.status(400).json({
        data: null,
        error: "Le montant payé est inférieur au montant de la consultation"
      });
    }

    // Créer une facture si demandé et si elle n'existe pas déjà
   // let currentInvoice = invoice;
    
   /*  if (createInvoice && !currentInvoice) {
      // Générer un numéro de facture unique
      const invoiceCount = await db.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${(invoiceCount + 1).toString().padStart(5, '0')}`;
      
      // Créer la facture
      currentInvoice = await db.invoice.create({
        data: {
          invoiceNumber,
          patientId: patient.id,
          accountantId,
          hospitalId: consultation.hospitalId,
          branchId: consultation.branchId,
          issueDate: new Date(),
          dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
          subtotalAmount: amountToPay,
          discountAmount: consultation.discountAmount || 0,
          totalAmount: amountToPay,
          paidAmount: paymentAmount,
          balanceAmount: 0, // Payé intégralement
          status: "PAID",
          patientType: "OUTPATIENT",
          patientCategory: patient.category,
          referenceType: "Consultation",
          referenceId: consultation.id,
          subscriptionId: consultation.subscriptionId,
          items: {
            create: {
              serviceId: "CONSULTATION_SERVICE_ID", // Remplacer par l'ID réel du service
          description: `Consultation avec Dr. ${doctor?.user?.lastName || 'Inconnu'}`,
              quantity: 1,
              unitPrice: amountToPay,
              discount: consultation.discountAmount || 0,
              totalPrice: amountToPay,
              itemType: "CONSULTATION"
            }
          },
          payments: {
            create: {
              amount: paymentAmount,
              paymentMethod,
              receivedBy: accountantId
            }
          }
        }
      });
      
      // Mettre à jour la consultation avec l'ID de la facture
      await db.consultation.update({
        where: { id },
        data: {
          // Nous ne pouvons pas utiliser invoiceId ou isPaid car ils n'existent pas dans le modèle
          // Nous pouvons ajouter une note pour indiquer que la consultation a été payée
          notes: consultation.notes 
            ? `${consultation.notes}\nPayée le ${new Date().toISOString()}`
            : `Payée le ${new Date().toISOString()}`
        }
      });
    } else {
      // Simplement marquer la consultation comme payée dans les notes
      await db.consultation.update({
        where: { id },
        data: {
          notes: consultation.notes 
            ? `${consultation.notes}\nPayée le ${new Date().toISOString()}`
            : `Payée le ${new Date().toISOString()}`
        }
      });
      
      // Si une facture existe déjà, ajouter un paiement
      if (currentInvoice) {
        await db.payment.create({
          data: {
            invoiceId: currentInvoice.id,
            amount: paymentAmount,
            paymentMethod,
            receivedBy: accountantId
          }
        });
        
        // Mettre à jour le montant payé et le statut de la facture
        await db.invoice.update({
          where: { id: currentInvoice.id },
          data: {
            paidAmount: {
              increment: paymentAmount
            },
            balanceAmount: {
              decrement: paymentAmount
            },
            status: "PAID"
          }
        });
      }
    } */

    return res.status(200).json({
      data: {
        consultationId: id,
        isPaid: true,
        paymentAmount,
        paymentMethod,
      /*   invoice: currentInvoice ? {
          id: currentInvoice.id,
          invoiceNumber: currentInvoice.invoiceNumber,
          totalAmount: currentInvoice.totalAmount
        } : null */
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors du paiement de la consultation"
    });
  }
}

/**
 * Ajoute un examen clinique à une consultation
 */
export async function addClinicalExamination(req: Request, res: Response) {
  const { consultationId } = req.params;
  const {
    generalAppearance,
    vitalSigns,
    heent,
    cardiovascular,
    respiratory,
    gastrointestinal,
    musculoskeletal,
    neurological,
    skin,
    findings,
    conclusion
  } = req.body;

  try {
    // Vérifier si la consultation existe
    const consultation = await db.consultation.findUnique({
      where: { id: consultationId },
      include: {
        doctor: true,
        patient: true
      }
    });

    if (!consultation) {
      return res.status(404).json({
        data: null,
        error: "Consultation non trouvée"
      });
    }

    // Créer l'examen clinique
    const clinicalExamination = await db.clinicalExamination.create({
      data: {
        patientId: consultation.patientId,
        doctorId: consultation.doctorId,
        consultationId,
        //hospitalId: consultation.hospitalId,
        //branchId: consultation.branchId,
        //generalAppearance,
       // vitalSigns: vitalSigns ? JSON.parse(vitalSigns) : undefined,
       // heent,
       // cardiovascular,
       // respiratory,
       // gastrointestinal,
       // musculoskeletal,
       // neurological,
       // skin,
        findings: findings ? JSON.parse(findings) : undefined,
       // conclusion
      }
    });

    return res.status(201).json({
      data: clinicalExamination,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de l'ajout de l'examen clinique"
    });
  }
}

/**
 * Ajoute un examen paraclinique à une consultation
 */
export async function addParaclinicalExam(req: Request, res: Response) {
  const { consultationId } = req.params;
  const {
    examType,
    priority,
    requestReason,
    clinicalContext,
    instructions,
    scheduledAt
  } = req.body;

  try {
    // Vérifier si la consultation existe
    const consultation = await db.consultation.findUnique({
      where: { id: consultationId },
      include: {
        doctor: true,
        patient: true
      }
    });

    if (!consultation) {
      return res.status(404).json({
        data: null,
        error: "Consultation non trouvée"
      });
    }

    // Créer l'examen paraclinique
    const paraclinicalExam = await db.paraclinicalExam.create({
      data: {
        patientId: consultation.patientId,
        doctorId: consultation.doctorId,
        consultationId,
       // hospitalId: consultation.hospitalId,
       // branchId: consultation.branchId,
        examType,
        priority: priority || "ROUTINE",
        requestReason,
        clinicalContext,
        instructions,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
      }
    });

    return res.status(201).json({
      data: paraclinicalExam,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de l'ajout de l'examen paraclinique"
    });
  }
}
