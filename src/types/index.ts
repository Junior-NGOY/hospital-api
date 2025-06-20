
import { AllergenType, AllergySeverity, ConditionType, MedicationForm } from "@prisma/client";
import { Request, Response } from "express";

export interface TypedRequestBody<T> extends Request {
  body: T;
}
// Types pour Queue
export interface QueueCreateProps {
    name: string;
    description?: string;
    departmentId?: string;
    isActive?: boolean;
  }
  
  export interface QueueUpdateProps {
    name?: string;
    description?: string;
    departmentId?: string;
    isActive?: boolean;
  }
  
  export interface QueueEntryCreateProps {
    queueId: string;
    patientId: string;
    priority?: 'EMERGENCY' | 'HIGH' | 'NORMAL' | 'LOW';
    status?: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'|'TRANSFERRED';
    notes?: string;
    createdById?: string; // ID du réceptionniste
  }
  
  export interface QueueEntryUpdateProps {
    status?: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'|'NO_SHOW'|'TRANSFERRED';
    priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
    notes?: string;
    assignedToId?: string | null; // ID du médecin
  }
  // Interface pour les données de création d'un patient
export interface PatientCreateProps {
    fileNumber: string;
    title?: 'MR' | 'MRS' | 'MISS' | null;
    name: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string; // Format ISO (YYYY-MM-DD)
    gender: 'MALE' | 'FEMALE';
    address?: string | null;
    admissionDate: string; // Format ISO (YYYY-MM-DD)
    maritalStatus?: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
    nationality?: string | null;
    profession?: string | null;
    phone?: string | null;
    email?: string | null;
    bloodType?: 'A_POSITIVE' | 'A_NEGATIVE' | 'B_POSITIVE' | 'B_NEGATIVE' | 'AB_POSITIVE' | 'AB_NEGATIVE' | 'O_POSITIVE' | 'O_NEGATIVE' | null;
    emergencyContact?: string | null;
    category?: 'PRIVATE' | 'SUBSCRIBER' ;
  }
  export interface PatientResponse {
    id: string;
    fileNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    bloodType: string | null;
    emergencyContact: string | null;
    category: string;
    createdAt: string;
    updatedAt: string;
    _count?: {
      consultations: number;
      prescriptions: number;
      labTests: number;
      allergies: number;
      medicalHistories: number;
    };
    age?: number;
  }

  // Interface pour les données de mise à jour d'un patient
    export interface PatientUpdateProps {
    fileNumber?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string; // Format ISO (YYYY-MM-DD)
    gender?: 'MALE' | 'FEMALE'  ;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    bloodType?: 'A_POSITIVE' | 'A_NEGATIVE' | 'B_POSITIVE' | 'B_NEGATIVE' | 'AB_POSITIVE' | 'AB_NEGATIVE' | 'O_POSITIVE' | 'O_NEGATIVE' | null;
    emergencyContact?: string | null;
    category?: 'PRIVATE' | 'SUBSCRIBER' ;
  }
  // Interface pour ajouter un patient à une file d'attente
    export interface PatientToQueueProps {
    queueId: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
    notes?: string;
  }

  // Interface pour ajouter une allergie à un patient
    export interface PatientAllergyProps {
    allergen: string;
    allergenType: AllergenType;
    severity: AllergySeverity;
    reaction?: string;
    diagnosedDate?: string; // Format ISO pour la date
    notes?: string;
  }
 // Interface pour ajouter un antécédent médical à un patient
 export interface MedicalHistoryProps {
    condition: string;
    conditionType: ConditionType; // Ajout du type de condition
    diagnosedDate?: string; // Format ISO pour la date
    notes?: string;
  }
  export interface VitalSignsProps {
    temperature?: number;
    heartRate?: number;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
  }
  
  export interface MedicationProps {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }
  
  export interface PrescriptionProps {
    medications: MedicationProps[];
  }
  
  export interface ConsultationCreateProps {
    patientId: string;
    doctorId: string;
    date?: Date | string;
    chiefComplaint: string;
    notes?: string;
    diagnosis?: string;
    treatmentPlan?: string;
    followUpInstructions?: string;
    vitalSigns?: VitalSignsProps;
    prescriptions?: PrescriptionProps[];
  }
  
  export interface ConsultationUpdateProps {
    chiefComplaint?: string;
    notes?: string;
    diagnosis?: string;
    treatmentPlan?: string;
    followUpInstructions?: string;
    status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    vitalSigns?: VitalSignsProps;
  }

  export type ChefComplaintProps = {
    description: string;
    slug: string;
  };

  export type medicationCategoryProps = {
    name: string;
    description?: string;
    parentCategoryId?: string;
  };
  export interface MedicationCreateProps {
    name: string;
    genericName?: string;
    form: MedicationForm;
    strength: string;
    manufacturer?: string;
    description?: string;
    sideEffects?: string;
    contraindications?: string;
    stock: number;
    unitPrice: number;
    categoryId?: string;
    purchasePrice?: number;
    markupPercentage?: number;
    sellingPrice: number;
    discountable?: boolean;
    taxable?: boolean;
    taxRate?: number;
    supplierId?: string;
  }
  
  export interface MedicationUpdateProps extends Partial<MedicationCreateProps> {
    id: string;
  }
