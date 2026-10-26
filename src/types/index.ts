/**
 * ApplyEase Data Types and Interfaces
 */

export type UserRole = 'student' | 'staff' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatarUrl?: string;
  registrationNumber?: string;
  department: string;
  designation?: string;
  phone: string;
  semester?: string;
  hostelRoom?: string;
  active: boolean;
}

/** A signing position (e.g. "Head of Department · Electrical Engineering") held by one staff member. */
export interface Designation {
  id: string;
  title: string;
  department: string;
  /** Short scope label shown in tables, e.g. "EE-15 A" or "UG programmes". */
  scope?: string;
  /** 'department' designations are only offered to students of that department. */
  reach: 'department' | 'university';
  holderId?: string;
  since: string;
  /** Head-level designations also affix the department seal when one exists. */
  affixesSeal: boolean;
  order: number;
}

export type FieldType = 
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'daterange'
  | 'number'
  | 'checkbox'
  | 'file'
  | 'profile_autofill';

export interface FormFieldCondition {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: any;
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required: boolean;
  options?: string[];
  autoFillProfileKey?: 'name' | 'registrationNumber' | 'email' | 'department' | 'phone' | 'hostelRoom';
  defaultValue?: any;
  validationRegex?: string;
  validationMessage?: string;
  condition?: FormFieldCondition;
  helpText?: string;
}

export interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  required: boolean;
  acceptedFormats: string[]; // e.g. ['pdf', 'png', 'jpg']
  maxSizeMB: number;
}

export interface FormTemplate {
  version: number;
  title: string;
  description: string;
  instructions: string;
  fields: FormFieldDefinition[];
  requiredDocuments: DocumentRequirement[];
  declarations: string[];
  feeRules: {
    required: boolean;
    amount: number;
    feeType?: string;
    instructions?: string;
  };
}

export interface SignatureSlot {
  id: string;
  roleTitle: string; // e.g. "Dean of Academic Affairs"
  requiredStaffRole: string; // e.g. "dean", "hod", "advisor"
  assignedStaffId?: string;
  xPercent: number; // 0 to 100 on page
  yPercent: number; // 0 to 100 on page
  widthPx: number;
  heightPx: number;
  showDate: boolean;
  showPrintedName: boolean;
}

export interface StampSlot {
  id: string;
  title: string; // e.g. "OFFICIAL SEAL - ACADEMIC SECTION"
  department: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  rotationDeg: number;
  opacity: number;
}

export interface OfficialDocumentTemplate {
  id: string;
  version: number;
  title: string; // e.g. "OFFICIAL LEAVE SANCTION CERTIFICATE"
  subtitle?: string;
  orientation: 'portrait' | 'landscape';
  headerNotice: string;
  bodyParagraphs: string[];
  signatureSlots: SignatureSlot[];
  stampSlots: StampSlot[];
  footerNotice: string;
  includeVerificationQR: boolean;
  /** Include the student's own saved signature as the first block. */
  includeStudentSignature?: boolean;
  /** Original PDF/Word template uploaded by the admin office. */
  sourceFile?: { name: string; dataUrl: string; size: number };
  updatedAt?: string;
}

export interface WorkflowStageDefinition {
  id: string;
  designationId?: string;
  order: number;
  name: string;
  assignedDepartment: string;
  assignedRole: string;
  assignedStaffId?: string;
  allowedActions: ('verify' | 'approve' | 'reject' | 'request_correction' | 'sign' | 'stamp')[];
  requiresSignature: boolean;
  signatureSlotId?: string;
  requiresStamp: boolean;
  stampSlotId?: string;
  slaHours: number;
  escalationPolicy: {
    warning1Hours: number;
    warning2Hours: number;
    warning3Hours: number;
    escalateToAdmin: boolean;
  };
}

export interface WorkflowDefinition {
  id: string;
  version: number;
  stages: WorkflowStageDefinition[];
}

export interface ApplicationType {
  id: string;
  key: string;
  title: string;
  description: string;
  category: 'academic' | 'hostel' | 'administrative' | 'financial';
  icon: string;
  estimatedDurationDays: number;
  active: boolean;
  publishedVersion: number;
  formConfig: FormTemplate;
  documentTemplate: OfficialDocumentTemplate;
  workflowDefinition: WorkflowDefinition;
  draftFormConfig?: FormTemplate;
  hasUnpublishedDraft?: boolean;
  /** Small label on the catalogue card, e.g. "Most used". */
  tag?: string;
  updatedAt?: string;
}

export type ApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'under_verification'
  | 'awaiting_payment'
  | 'awaiting_student_action'
  | 'pending_approval'
  | 'pending_signature'
  | 'overdue'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface UploadedDocument {
  id: string;
  requirementId: string;
  requirementName: string;
  fileName: string;
  fileDataUrl: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface ApplicationStageInstance {
  stageId: string;
  designationId?: string;
  openedAt?: string;
  lastReminderAt?: string;
  name: string;
  assignedDepartment: string;
  assignedRole: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'escalated';
  startedAt?: string;
  completedAt?: string;
  deadline?: string;
  warningCount: number;
  decisionNotes?: string;
  actionTakenBy?: string;
  signatureApplied?: boolean;
  signatureAssetUrl?: string;
  stampApplied?: boolean;
  stampAssetUrl?: string;
  slaHours: number;
  requiresSignature?: boolean;
  requiresStamp?: boolean;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  stageName: string;
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  type: 'opened' | 'reminder' | 'withdrawn' | 'submission' | 'verification' | 'approval' | 'rejection' | 'correction_request' | 'signature' | 'warning' | 'escalation' | 'issuance';
}

export interface IssuedDocument {
  id: string;
  documentNumber: string;
  referenceNumber: string;
  generatedAt: string;
  verificationCode: string;
  documentHash: string;
  pdfDataUrl?: string;
  /** Renderer version of pdfDataUrl; older files are regenerated on demand. */
  pdfVersion?: number;
  /** SHA-256 of the exact PDF bytes, used to verify an uploaded copy. */
  pdfFileHash?: string;
  pageCount?: number;
  appliedSignatures: {
    slotId: string;
    staffName: string;
    roleTitle: string;
    timestamp: string;
    signatureUrl: string;
  }[];
  appliedStamps: {
    slotId: string;
    stampName: string;
    timestamp: string;
    stampUrl: string;
  }[];
}

export interface Application {
  id: string;
  referenceNumber: string;
  applicationTypeId: string;
  applicationTypeTitle: string;
  templateVersion: number;
  studentId: string;
  studentSnapshot: {
    name: string;
    registrationNumber: string;
    email: string;
    department: string;
    phone: string;
  };
  status: ApplicationStatus;
  currentStageId: string;
  currentStageIndex: number;
  formData: Record<string, any>;
  uploadedDocuments: UploadedDocument[];
  paymentRecord?: {
    required: boolean;
    amount: number;
    receiptUrl?: string;
    paymentReference?: string;
    status: 'pending' | 'receipt_submitted' | 'verified' | 'rejected';
    verifiedAt?: string;
    verifiedBy?: string;
  };
  stageInstances: ApplicationStageInstance[];
  timeline: TimelineEvent[];
  issuedDocument?: IssuedDocument;
  createdAt: string;
  updatedAt: string;
  submissionDate?: string;
  estimatedCompletionDate?: string;
  targetDeadline?: string;
  correctionRequestNote?: string;
  /** 'form' = filled online, 'upload' = student's own document. */
  source?: 'form' | 'upload';
  /** Smart-scan findings and whether the student edited the suggested chain. */
  scan?: { tags: string[]; reasons: string[]; suggestedDesignationIds: string[]; edited: boolean };
}

export interface SignatureAsset {
  id: string;
  name: string;
  type: 'signature';
  imageUrl: string;
  originalImageUrl: string;
  ownerName: string;
  ownerId?: string;
  ownerRole: string;
  department: string;
  isTransparent: boolean;
  opacity: number;
  active: boolean;
  createdAt: string;
  auditHash: string;
}

export interface StampAsset {
  id: string;
  name: string;
  type: 'stamp';
  imageUrl: string;
  originalImageUrl: string;
  department: string;
  isTransparent: boolean;
  opacity: number;
  active: boolean;
  createdAt: string;
  auditHash: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  details: string;
  applicationRef?: string;
  ipAddress?: string;
  /** Hash chain: sha256(prevHash + canonical entry). */
  prevHash?: string;
  entryHash?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: boolean;
  createdAt: string;
  applicationRef?: string;
}
