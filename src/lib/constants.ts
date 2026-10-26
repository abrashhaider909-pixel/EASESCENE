/**
 * EzScene seed data
 * ---------------------------------------------------------------------------
 * The first run (or an empty Supabase project) is populated with this dataset:
 * accounts, designations, form templates, saved signatures, department seals
 * and a handful of requests in different states so every screen has content.
 */

import {
  UserProfile,
  ApplicationType,
  Application,
  SignatureAsset,
  StampAsset,
  AuditLog,
  NotificationItem,
  Designation,
  FormFieldDefinition,
  ApplicationStageInstance,
  TimelineEvent,
  WorkflowStageDefinition
} from '../types';
import { generateOfficialStampSvg, generateSampleSignatureSvg } from './imageProcessor';
import { UNIVERSITY_NAME } from '../config';

export const DEPARTMENTS = [
  'Electrical Engineering',
  'Computer Science',
  'Mechanical Engineering',
  'Faculty of Engineering',
  'UG Programmes',
  'Administration',
  'Hostels'
];

export const PROGRAMMES = [
  'BE Electrical Engineering, EE-15 A',
  'BE Electrical Engineering, EE-15 B',
  'BE Electrical Engineering, EE-14 A',
  'BS Computer Science, CS-14 B',
  'BS Computer Science, CS-15 A',
  'BE Mechanical Engineering, ME-15 A'
];

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ahead = (ms: number) => new Date(NOW + ms).toISOString();

/* ------------------------------------------------------------------ users */

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'admin-registrar',
    name: "Registrar's office",
    email: 'admin@gmail.com',
    password: '123',
    role: 'admin',
    department: 'Administration',
    designation: 'Administrator',
    phone: '+92 51 000 0000',
    active: true
  },
  // Students
  {
    id: 'student-hamza',
    name: 'Hamza Tariq',
    email: 'hamza.tariq@student.uni.edu.pk',
    password: '123',
    role: 'student',
    registrationNumber: '412345',
    department: 'Electrical Engineering',
    semester: 'BE Electrical Engineering, EE-15 A',
    hostelRoom: 'Block C · Room 214',
    phone: '+92 300 1234567',
    active: true
  },
  {
    id: 'student-mahnoor',
    name: 'Mahnoor Iqbal',
    email: 'mahnoor.iqbal@student.uni.edu.pk',
    password: '123',
    role: 'student',
    registrationNumber: '412377',
    department: 'Electrical Engineering',
    semester: 'BE Electrical Engineering, EE-15 A',
    phone: '+92 301 7654321',
    active: true
  },
  {
    id: 'student-usman',
    name: 'Usman Ali',
    email: 'usman.ali@student.uni.edu.pk',
    password: '123',
    role: 'student',
    registrationNumber: '409812',
    department: 'Electrical Engineering',
    semester: 'BE Electrical Engineering, EE-14 A',
    phone: '+92 302 1112233',
    active: true
  },
  {
    id: 'student-areeba',
    name: 'Areeba Shah',
    email: 'areeba.shah@student.uni.edu.pk',
    password: '123',
    role: 'student',
    registrationNumber: '415503',
    department: 'Electrical Engineering',
    semester: 'BE Electrical Engineering, EE-15 B',
    phone: '+92 303 4445566',
    active: true
  },
  // Faculty & authorities
  {
    id: 'staff-sana',
    name: 'Dr. Sana Javed',
    email: 'sana.javed@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'Electrical Engineering',
    designation: 'Course Advisor',
    phone: '+92 51 111 0001',
    active: true
  },
  {
    id: 'staff-bilal',
    name: 'Engr. Bilal Ahmed',
    email: 'bilal.ahmed@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'UG Programmes',
    designation: 'Coordinator',
    phone: '+92 51 111 0002',
    active: true
  },
  {
    id: 'staff-faisal',
    name: 'Dr. Faisal Rehman',
    email: 'faisal.rehman@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'Electrical Engineering',
    designation: 'Associate HoD',
    phone: '+92 51 111 0003',
    active: true
  },
  {
    id: 'staff-ayesha',
    name: 'Dr. Ayesha Malik',
    email: 'ayesha.malik@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'Electrical Engineering',
    designation: 'Head of Department',
    phone: '+92 51 111 0004',
    active: true
  },
  {
    id: 'staff-nadia',
    name: 'Dr. Nadia Hussain',
    email: 'nadia.hussain@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'Computer Science',
    designation: 'Head of Department',
    phone: '+92 51 111 0005',
    active: true
  },
  {
    id: 'staff-omar',
    name: 'Dr. Omar Farooq',
    email: 'omar.farooq@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'Computer Science',
    designation: 'Course Advisor',
    phone: '+92 51 111 0006',
    active: true
  },
  {
    id: 'staff-imran',
    name: 'Dr. Imran Qureshi',
    email: 'imran.qureshi@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'Faculty of Engineering',
    designation: 'Dean',
    phone: '+92 51 111 0007',
    active: true
  },
  {
    id: 'staff-kamran',
    name: 'Mr. Kamran Shah',
    email: 'kamran.shah@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'Administration',
    designation: 'Registrar',
    phone: '+92 51 111 0008',
    active: true
  },
  {
    id: 'staff-ghani',
    name: 'Mr. Usman Ghani',
    email: 'usman.ghani@uni.edu.pk',
    password: '123',
    role: 'staff',
    department: 'Hostels',
    designation: 'Hostel Warden',
    phone: '+92 51 111 0009',
    active: true
  }
];

/* ------------------------------------------------------------ designations */

export const INITIAL_DESIGNATIONS: Designation[] = [
  { id: 'des-hod-ee', title: 'Head of Department', department: 'Electrical Engineering', reach: 'department', holderId: 'staff-ayesha', since: '2025-08-01', affixesSeal: true, order: 1 },
  { id: 'des-assoc-hod-ee', title: 'Associate HoD', department: 'Electrical Engineering', reach: 'department', holderId: 'staff-faisal', since: '2025-08-01', affixesSeal: false, order: 2 },
  { id: 'des-hod-cs', title: 'Head of Department', department: 'Computer Science', reach: 'department', holderId: 'staff-nadia', since: '2026-01-10', affixesSeal: true, order: 3 },
  { id: 'des-dean', title: 'Dean', department: 'Faculty of Engineering', reach: 'university', holderId: 'staff-imran', since: '2024-03-01', affixesSeal: true, order: 4 },
  { id: 'des-advisor-ee', title: 'Course Advisor', department: 'Electrical Engineering', scope: 'EE-15 A', reach: 'department', holderId: 'staff-sana', since: '2025-09-01', affixesSeal: false, order: 5 },
  { id: 'des-advisor-cs', title: 'Course Advisor', department: 'Computer Science', scope: 'CS-14 B', reach: 'department', holderId: 'staff-omar', since: '2025-09-01', affixesSeal: false, order: 6 },
  { id: 'des-coordinator', title: 'Coordinator', department: 'UG Programmes', reach: 'university', holderId: 'staff-bilal', since: '2026-02-01', affixesSeal: false, order: 7 },
  { id: 'des-registrar', title: 'Registrar', department: 'Administration', reach: 'university', holderId: 'staff-kamran', since: '2023-07-01', affixesSeal: true, order: 8 },
  { id: 'des-warden', title: 'Hostel Warden', department: 'Hostels', reach: 'university', holderId: 'staff-ghani', since: '2026-06-01', affixesSeal: true, order: 9 }
];

/* ---------------------------------------------------- signatures & seals */

const sig = (id: string, owner: UserProfile, variant: 1 | 2 | 3, color = '#1B2A6B'): SignatureAsset => {
  const url = generateSampleSignatureSvg(owner.name, variant, color);
  return {
    id,
    name: `${owner.name} — signature`,
    type: 'signature',
    imageUrl: url,
    originalImageUrl: url,
    ownerName: owner.name,
    ownerId: owner.id,
    ownerRole: owner.designation || 'Student',
    department: owner.department,
    isTransparent: true,
    opacity: 1,
    active: true,
    createdAt: '2026-10-12T09:00:00Z',
    auditHash: `sha256-${id}`
  };
};
const user = (id: string) => INITIAL_USERS.find(u => u.id === id)!;

// Dr. Faisal Rehman intentionally has no saved signature, so signing in as him
// walks through the signature onboarding flow.
export const INITIAL_SIGNATURES: SignatureAsset[] = [
  sig('sig-sana', user('staff-sana'), 1),
  sig('sig-ayesha', user('staff-ayesha'), 2),
  sig('sig-imran', user('staff-imran'), 3, '#111111'),
  sig('sig-bilal', user('staff-bilal'), 1),
  sig('sig-nadia', user('staff-nadia'), 2),
  sig('sig-omar', user('staff-omar'), 3),
  sig('sig-kamran', user('staff-kamran'), 1, '#111111'),
  sig('sig-ghani', user('staff-ghani'), 2),
  sig('sig-hamza', user('student-hamza'), 3)
];

const seal = (id: string, department: string, line: string, serial: string): StampAsset => {
  const url = generateOfficialStampSvg(UNIVERSITY_NAME, line, serial, '#0A6F80', 0.9);
  return {
    id,
    name: `${department} seal`,
    type: 'stamp',
    imageUrl: url,
    originalImageUrl: url,
    department,
    isTransparent: true,
    opacity: 0.9,
    active: true,
    createdAt: '2026-01-10T10:00:00Z',
    auditHash: `sha256-${id}`
  };
};

export const INITIAL_STAMPS: StampAsset[] = [
  seal('seal-ee', 'Electrical Engineering', 'Dept. of Electrical Engg.', 'EE-SEAL-26'),
  seal('seal-cs', 'Computer Science', 'Dept. of Computer Science', 'CS-SEAL-26'),
  seal('seal-dean', 'Faculty of Engineering', 'Office of the Dean', 'FOE-SEAL-26'),
  seal('seal-registrar', 'Administration', 'Office of the Registrar', 'REG-SEAL-26'),
  seal('seal-hostels', 'Hostels', 'Hostel Administration', 'HST-SEAL-26')
];

/* ---------------------------------------------------------- form templates */

const autofillName: FormFieldDefinition = { id: 'student_name', label: 'Full name', type: 'profile_autofill', autoFillProfileKey: 'name', required: true };
const autofillCms: FormFieldDefinition = { id: 'reg_no', label: 'CMS ID', type: 'profile_autofill', autoFillProfileKey: 'registrationNumber', required: true };
const programmeField: FormFieldDefinition = { id: 'programme', label: 'Programme & section', type: 'select', required: true, options: PROGRAMMES };

export function stageFromDesignation(d: Designation, order: number): WorkflowStageDefinition {
  return {
    id: `stage-${d.id}`,
    designationId: d.id,
    order,
    name: d.title,
    assignedDepartment: d.department,
    assignedRole: d.title,
    assignedStaffId: d.holderId,
    allowedActions: ['approve', 'reject', 'request_correction', 'sign'],
    requiresSignature: true,
    requiresStamp: false,
    slaHours: 24,
    escalationPolicy: { warning1Hours: 12, warning2Hours: 18, warning3Hours: 22, escalateToAdmin: true }
  };
}

const des = (id: string) => INITIAL_DESIGNATIONS.find(d => d.id === id)!;
const chain = (...ids: string[]) => ids.map((id, i) => stageFromDesignation(des(id), i + 1));

interface TypeSpec {
  id: string;
  key: string;
  title: string;
  tag: string;
  description: string;
  category: ApplicationType['category'];
  fields: FormFieldDefinition[];
  docTitle: string;
  body: string[];
  chainIds: string[];
  version: number;
  updatedAt: string;
  active?: boolean;
  supportingDoc?: string;
  includeStudentSignature?: boolean;
}

function makeType(spec: TypeSpec): ApplicationType {
  return {
    id: spec.id,
    key: spec.key,
    title: spec.title,
    tag: spec.tag,
    description: spec.description,
    category: spec.category,
    icon: 'FileText',
    estimatedDurationDays: Math.max(1, spec.chainIds.length),
    active: spec.active !== false,
    publishedVersion: spec.version,
    updatedAt: spec.updatedAt,
    formConfig: {
      version: spec.version,
      title: spec.title,
      description: spec.description,
      instructions: '',
      fields: spec.fields,
      requiredDocuments: [
        {
          id: 'doc-supporting',
          name: spec.supportingDoc || 'Supporting document',
          description: 'PDF or JPG',
          required: false,
          acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
          maxSizeMB: 10
        }
      ],
      declarations: [],
      feeRules: { required: false, amount: 0 }
    },
    documentTemplate: {
      id: `tpl-${spec.key}`,
      version: spec.version,
      title: spec.docTitle,
      orientation: 'portrait',
      headerNotice: '',
      bodyParagraphs: spec.body,
      signatureSlots: [],
      stampSlots: [],
      footerNotice: '',
      includeVerificationQR: true,
      includeStudentSignature: spec.includeStudentSignature !== false,
      updatedAt: spec.updatedAt
    },
    workflowDefinition: { id: `wf-${spec.key}`, version: spec.version, stages: chain(...spec.chainIds) }
  };
}

export const CUSTOM_UPLOAD_TYPE_ID = 'type-custom-upload';

export const INITIAL_APPLICATION_TYPES: ApplicationType[] = [
  makeType({
    id: 'type-leave',
    key: 'leave-request',
    title: 'Leave Request',
    tag: 'Most used',
    description: 'Absence from classes for medical, personal or family reasons.',
    category: 'academic',
    version: 3,
    updatedAt: '2026-10-14T10:00:00Z',
    supportingDoc: 'Medical certificate or other proof',
    fields: [
      autofillName,
      autofillCms,
      programmeField,
      { id: 'leave_type', label: 'Type of leave', type: 'select', required: true, options: ['Medical', 'Personal', 'Family emergency'], helpText: 'radio' },
      { id: 'start_date', label: 'From', type: 'date', required: true },
      { id: 'end_date', label: 'To', type: 'date', required: true },
      { id: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Briefly explain the reason for your absence.' }
    ],
    docTitle: 'LEAVE APPLICATION',
    body: [
      'Date: {{submission_date}}',
      'To: The Head of Department, {{department}}',
      'I, **{{student_name}}** (CMS ID {{reg_no}}), a student of **{{programme}}**, request **{{leave_type|lower}}** leave from **{{start_date}}** to **{{end_date}}** ({{days}}).',
      'Reason: {{reason}}'
    ],
    chainIds: ['des-advisor-ee', 'des-hod-ee']
  }),
  makeType({
    id: 'type-noc',
    key: 'noc',
    title: 'No Objection Certificate',
    tag: 'NOC',
    description: 'For internships, visas, competitions or external events.',
    category: 'administrative',
    version: 2,
    updatedAt: '2026-09-02T10:00:00Z',
    fields: [
      autofillName,
      autofillCms,
      programmeField,
      { id: 'purpose', label: 'Purpose', type: 'select', required: true, options: ['Internship', 'Visa', 'Competition', 'External event'], helpText: 'radio' },
      { id: 'organisation', label: 'Organisation / event', type: 'text', required: true, placeholder: 'e.g. National Grid Company' },
      { id: 'start_date', label: 'From', type: 'date', required: true },
      { id: 'end_date', label: 'To', type: 'date', required: true },
      { id: 'details', label: 'Details', type: 'textarea', required: false, placeholder: 'Anything the department should know.' }
    ],
    docTitle: 'NO OBJECTION CERTIFICATE',
    body: [
      'This is to certify that **{{student_name}}** (CMS ID {{reg_no}}), a student of {{programme}}, is in good academic standing.',
      'The department has no objection to the student undertaking the {{purpose|lower}} at **{{organisation}}** from {{start_date}} to {{end_date}}, provided it does not conflict with the academic schedule.'
    ],
    chainIds: ['des-advisor-ee', 'des-hod-ee', 'des-dean'],
    includeStudentSignature: false
  }),
  makeType({
    id: 'type-clearance',
    key: 'clearance',
    title: 'Clearance Form',
    tag: 'Degree end',
    description: 'Department, hostel and accounts clearance before graduation.',
    category: 'administrative',
    version: 4,
    updatedAt: '2026-08-20T10:00:00Z',
    fields: [
      autofillName,
      autofillCms,
      programmeField,
      { id: 'final_semester', label: 'Final semester', type: 'text', required: true, placeholder: 'e.g. Spring 2027' },
      { id: 'hostel_resident', label: 'Hostel resident', type: 'select', required: true, options: ['Yes', 'No'], helpText: 'radio' },
      { id: 'remarks', label: 'Remarks', type: 'textarea', required: false }
    ],
    docTitle: 'DEGREE CLEARANCE CERTIFICATE',
    body: [
      'This is to certify that **{{student_name}}** (CMS ID {{reg_no}}) of {{programme}}, completing the degree in {{final_semester}}, has no outstanding dues or materials with the offices listed below.',
      'Hostel resident: {{hostel_resident}}. {{remarks}}'
    ],
    chainIds: ['des-coordinator', 'des-warden', 'des-registrar']
  }),
  makeType({
    id: 'type-freeze',
    key: 'semester-freeze',
    title: 'Semester Freeze',
    tag: 'Academic',
    description: 'Pause your studies for a semester with a stated reason.',
    category: 'academic',
    version: 1,
    updatedAt: '2026-01-11T10:00:00Z',
    fields: [
      autofillName,
      autofillCms,
      programmeField,
      { id: 'semester_to_freeze', label: 'Semester to freeze', type: 'text', required: true, placeholder: 'e.g. Spring 2027' },
      { id: 'expected_return', label: 'Expected return', type: 'text', required: true, placeholder: 'e.g. Fall 2027' },
      { id: 'reason', label: 'Reason', type: 'textarea', required: true }
    ],
    docTitle: 'SEMESTER FREEZE APPROVAL',
    body: [
      'I, **{{student_name}}** (CMS ID {{reg_no}}), a student of {{programme}}, request to freeze my studies for **{{semester_to_freeze}}** and expect to resume in **{{expected_return}}**.',
      'Reason: {{reason}}'
    ],
    chainIds: ['des-advisor-ee', 'des-hod-ee', 'des-dean', 'des-registrar']
  }),
  makeType({
    id: 'type-hostel-leave',
    key: 'hostel-leave',
    title: 'Hostel Leave',
    tag: 'Hostel',
    description: 'Overnight or weekend leave from the university hostel.',
    category: 'hostel',
    version: 2,
    updatedAt: '2026-06-03T10:00:00Z',
    fields: [
      autofillName,
      autofillCms,
      { id: 'room', label: 'Hostel & room', type: 'profile_autofill', autoFillProfileKey: 'hostelRoom', required: true },
      { id: 'start_date', label: 'Leaving on', type: 'date', required: true },
      { id: 'end_date', label: 'Returning on', type: 'date', required: true },
      { id: 'destination', label: 'Destination', type: 'text', required: true, placeholder: 'City and address' },
      { id: 'guardian_phone', label: 'Guardian phone', type: 'text', required: true, placeholder: '+92 300 0000000' }
    ],
    docTitle: 'HOSTEL LEAVE PASS',
    body: [
      '**{{student_name}}** (CMS ID {{reg_no}}), resident of {{room}}, is permitted to leave the hostel from **{{start_date}}** to **{{end_date}}**.',
      'Destination: {{destination}}. Guardian contact: {{guardian_phone}}.'
    ],
    chainIds: ['des-warden']
  }),
  makeType({
    id: 'type-add-drop',
    key: 'course-add-drop',
    title: 'Course Add / Drop',
    tag: 'Academic',
    description: 'Add or drop a course after the registration window.',
    category: 'academic',
    version: 1,
    updatedAt: '2026-02-15T10:00:00Z',
    fields: [
      autofillName,
      autofillCms,
      programmeField,
      { id: 'action', label: 'Request', type: 'select', required: true, options: ['Add', 'Drop'], helpText: 'radio' },
      { id: 'course_code', label: 'Course code', type: 'text', required: true, placeholder: 'e.g. EE-301' },
      { id: 'course_title', label: 'Course title', type: 'text', required: true, placeholder: 'e.g. Signals & Systems' },
      { id: 'reason', label: 'Reason', type: 'textarea', required: true }
    ],
    docTitle: 'COURSE ADD / DROP APPROVAL',
    body: [
      'I, **{{student_name}}** (CMS ID {{reg_no}}) of {{programme}}, request to **{{action|lower}}** the course **{{course_code}} — {{course_title}}** after the registration window.',
      'Reason: {{reason}}'
    ],
    chainIds: ['des-advisor-ee', 'des-coordinator']
  }),
  makeType({
    id: 'type-transcript',
    key: 'transcript',
    title: 'Transcript Request',
    tag: 'Records',
    description: 'Official transcript for further studies or employment.',
    category: 'administrative',
    version: 1,
    updatedAt: '2024-03-09T10:00:00Z',
    active: false,
    fields: [autofillName, autofillCms, { id: 'copies', label: 'Number of copies', type: 'number', required: true }],
    docTitle: 'TRANSCRIPT REQUEST',
    body: ['**{{student_name}}** (CMS ID {{reg_no}}) requests {{copies}} official transcript copies.'],
    chainIds: ['des-registrar']
  }),
  makeType({
    id: CUSTOM_UPLOAD_TYPE_ID,
    key: 'custom-upload',
    title: 'Custom upload',
    tag: 'Upload',
    description: "A student's own PDF or Word document routed for signatures.",
    category: 'administrative',
    version: 1,
    updatedAt: '2026-01-01T10:00:00Z',
    fields: [
      { id: 'subject', label: 'Subject', type: 'text', required: true },
      { id: 'notes', label: 'Note to signers', type: 'textarea', required: false }
    ],
    docTitle: 'APPROVAL SHEET',
    body: [
      'The attached document "**{{subject}}**" submitted by **{{student_name}}** (CMS ID {{reg_no}}) has been reviewed and approved by the authorities below.'
    ],
    chainIds: ['des-advisor-ee', 'des-hod-ee'],
    includeStudentSignature: false
  })
];

/* ------------------------------------------------------- demo requests */

function stageInstances(chainIds: string[], doneCount: number, startedAt: number, opts: { rejectedAt?: number; rejectNote?: string } = {}): ApplicationStageInstance[] {
  return chainIds.map((id, i) => {
    const d = des(id);
    const holder = user(d.holderId!);
    const sigAsset = INITIAL_SIGNATURES.find(s => s.ownerId === holder.id);
    const stamp = d.affixesSeal ? INITIAL_STAMPS.find(s => s.department === d.department) : undefined;
    const completed = i < doneCount;
    const current = i === doneCount;
    const stageStart = startedAt + i * 2 * HOUR;
    const base: ApplicationStageInstance = {
      stageId: `stage-${d.id}`,
      designationId: d.id,
      name: d.title,
      assignedDepartment: d.department,
      assignedRole: d.title,
      assignedStaffId: holder.id,
      assignedStaffName: holder.name,
      status: completed ? 'completed' : current ? 'in_progress' : 'pending',
      warningCount: 0,
      slaHours: 24,
      requiresSignature: true,
      requiresStamp: false
    };
    if (completed) {
      return {
        ...base,
        startedAt: new Date(stageStart).toISOString(),
        openedAt: new Date(stageStart + 20 * 60 * 1000).toISOString(),
        completedAt: new Date(stageStart + HOUR).toISOString(),
        actionTakenBy: holder.name,
        decisionNotes: 'Approved',
        signatureApplied: true,
        signatureAssetUrl: sigAsset?.imageUrl,
        stampApplied: Boolean(stamp),
        stampAssetUrl: stamp?.imageUrl
      };
    }
    if (current) {
      if (opts.rejectedAt) {
        return {
          ...base,
          status: 'rejected',
          startedAt: new Date(stageStart).toISOString(),
          completedAt: new Date(opts.rejectedAt).toISOString(),
          actionTakenBy: holder.name,
          decisionNotes: opts.rejectNote
        };
      }
      return {
        ...base,
        startedAt: new Date(stageStart).toISOString(),
        deadline: new Date(stageStart + 24 * HOUR).toISOString()
      };
    }
    return base;
  });
}

function timelineFor(app: { ref: string; student: UserProfile; stages: ApplicationStageInstance[]; submittedAt: number }): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `tl-${app.ref}-sub`,
      timestamp: new Date(app.submittedAt).toISOString(),
      stageName: 'Submission',
      title: 'Submitted by you',
      description: `chain: ${app.stages.map(s => shortTitle(s.assignedRole)).join(' → ')}`,
      actorName: app.student.name,
      actorRole: 'student',
      type: 'submission'
    }
  ];
  app.stages.forEach((s, i) => {
    if (s.openedAt) {
      events.push({ id: `tl-${app.ref}-o${i}`, timestamp: s.openedAt, stageName: s.name, title: `Opened by ${s.assignedStaffName}`, description: '', actorName: s.assignedStaffName!, actorRole: s.assignedRole, type: 'opened' });
    }
    if (s.status === 'completed') {
      events.push({ id: `tl-${app.ref}-a${i}`, timestamp: s.completedAt!, stageName: s.name, title: `Approved and signed by ${s.assignedStaffName} (${s.assignedRole})`, description: 'signature stamped on page 1', actorName: s.assignedStaffName!, actorRole: s.assignedRole, type: 'signature' });
    }
    if (s.status === 'in_progress') {
      events.push({ id: `tl-${app.ref}-s${i}`, timestamp: s.startedAt!, stageName: s.name, title: `Sent to ${s.assignedStaffName} (${s.assignedRole})`, description: '', actorName: 'EzScene', actorRole: 'system', type: 'verification' });
    }
    if (s.status === 'rejected') {
      events.push({ id: `tl-${app.ref}-r${i}`, timestamp: s.completedAt!, stageName: s.name, title: `Rejected by ${s.assignedStaffName} (${s.assignedRole})`, description: `Reason: ${s.decisionNotes}`, actorName: s.assignedStaffName!, actorRole: s.assignedRole, type: 'rejection' });
    }
  });
  return events;
}

export function shortTitle(title: string): string {
  if (/^head of department$/i.test(title)) return 'HoD';
  if (/^course advisor$/i.test(title)) return 'Advisor';
  if (/^hostel warden$/i.test(title)) return 'Warden';
  return title;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayOffset = (days: number) => iso(new Date(NOW + days * DAY));

function snapshot(u: UserProfile) {
  return { name: u.name, registrationNumber: u.registrationNumber || '', email: u.email, department: u.department, phone: u.phone };
}

interface DemoSpec {
  id: string;
  ref: string;
  typeId: string;
  studentId: string;
  chainIds: string[];
  done: number;
  submittedAgo: number;
  formData: Record<string, any>;
  status: Application['status'];
  rejectNote?: string;
  rejectAgo?: number;
  source?: 'form' | 'upload';
  uploads?: Application['uploadedDocuments'];
}

function demo(spec: DemoSpec): Application {
  const type = INITIAL_APPLICATION_TYPES.find(t => t.id === spec.typeId)!;
  const student = user(spec.studentId);
  const submittedAt = NOW - spec.submittedAgo;
  const stages = stageInstances(spec.chainIds, spec.done, submittedAt, spec.rejectAgo ? { rejectedAt: NOW - spec.rejectAgo, rejectNote: spec.rejectNote } : {});
  const currentIndex = Math.min(spec.done, stages.length - 1);
  return {
    id: spec.id,
    referenceNumber: spec.ref,
    applicationTypeId: type.id,
    applicationTypeTitle: type.title,
    templateVersion: type.publishedVersion,
    studentId: student.id,
    studentSnapshot: snapshot(student),
    status: spec.status,
    currentStageId: stages[currentIndex].stageId,
    currentStageIndex: currentIndex,
    formData: { student_name: student.name, reg_no: student.registrationNumber, programme: student.semester, ...spec.formData },
    uploadedDocuments: spec.uploads || [],
    stageInstances: stages,
    timeline: timelineFor({ ref: spec.ref, student, stages, submittedAt }),
    createdAt: new Date(submittedAt).toISOString(),
    updatedAt: new Date(spec.rejectAgo ? NOW - spec.rejectAgo : NOW - Math.max(0, spec.submittedAgo - spec.done * 2 * HOUR - HOUR)).toISOString(),
    submissionDate: new Date(submittedAt).toISOString(),
    source: spec.source || 'form',
    scan: {
      tags: [],
      reasons: [],
      suggestedDesignationIds: spec.chainIds,
      edited: false
    }
  };
}

/** A tiny, valid one-page PDF used as the demo "custom upload". */
function samplePdfDataUrl(lines: string[]): string {
  const text = lines
    .map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 72 ${740 - i * 26} Td (${l.replace(/[()\\]/g, '')}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(o => (pdf += `${String(o).padStart(10, '0')} 00000 n \n`));
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(pdf)}`;
}

const areebaPdf = samplePdfDataUrl([
  'Request for extended lab access',
  'To: Head of Department, Electrical Engineering',
  'I request access to the Power Electronics Lab after 6 pm',
  'for my final-year project during November 2026.',
  'Areeba Shah, CMS 415503, EE-15 B'
]);

export const INITIAL_APPLICATIONS: Application[] = [
  demo({
    id: 'app-0412',
    ref: 'EZ-2026-0412',
    typeId: 'type-leave',
    studentId: 'student-hamza',
    chainIds: ['des-advisor-ee', 'des-hod-ee', 'des-dean'],
    done: 1,
    submittedAgo: 2 * HOUR + 40 * 60 * 1000,
    status: 'pending_signature',
    formData: {
      leave_type: 'Medical',
      start_date: dayOffset(23),
      end_date: dayOffset(25),
      reason: 'Fever and throat infection; advised three days of bed rest by the university medical centre. Certificate attached.'
    },
    uploads: [
      {
        id: 'up-0412',
        requirementId: 'doc-supporting',
        requirementName: 'Medical certificate',
        fileName: 'medical-certificate.pdf',
        fileDataUrl: samplePdfDataUrl(['University Medical Centre', 'Patient: Hamza Tariq (CMS 412345)', 'Diagnosis: acute pharyngitis with fever', 'Advice: bed rest for three days']),
        fileSize: 1400,
        fileType: 'application/pdf',
        uploadedAt: ago(3 * HOUR),
        status: 'pending'
      }
    ]
  }),
  demo({
    id: 'app-0410',
    ref: 'EZ-2026-0410',
    typeId: 'type-noc',
    studentId: 'student-mahnoor',
    chainIds: ['des-advisor-ee', 'des-hod-ee', 'des-dean'],
    done: 1,
    submittedAgo: 7 * HOUR,
    status: 'pending_signature',
    formData: { purpose: 'Internship', organisation: 'National Grid Company', start_date: dayOffset(60), end_date: dayOffset(100), details: 'Summer internship in the protection department.' }
  }),
  demo({
    id: 'app-0408',
    ref: 'EZ-2026-0408',
    typeId: 'type-freeze',
    studentId: 'student-usman',
    chainIds: ['des-advisor-ee', 'des-hod-ee', 'des-dean', 'des-registrar'],
    done: 1,
    submittedAgo: 28 * HOUR,
    status: 'pending_signature',
    formData: { semester_to_freeze: 'Spring 2027', expected_return: 'Fall 2027', reason: 'Family business responsibilities after my father’s surgery.' }
  }),
  demo({
    id: 'app-0409',
    ref: 'EZ-2026-0409',
    typeId: CUSTOM_UPLOAD_TYPE_ID,
    studentId: 'student-areeba',
    chainIds: ['des-hod-ee', 'des-dean'],
    done: 0,
    submittedAgo: 26 * HOUR,
    status: 'pending_signature',
    source: 'upload',
    formData: { subject: 'Request for extended lab access', notes: 'Final-year project, November 2026.' },
    uploads: [
      {
        id: 'up-0409',
        requirementId: 'doc-original',
        requirementName: 'Uploaded document',
        fileName: 'Lab access request — Areeba Shah.pdf',
        fileDataUrl: areebaPdf,
        fileSize: 900,
        fileType: 'application/pdf',
        uploadedAt: ago(26 * HOUR),
        status: 'pending'
      }
    ]
  }),
  {
    ...demo({
      id: 'app-0398',
      ref: 'EZ-2026-0398',
      typeId: 'type-noc',
      studentId: 'student-hamza',
      chainIds: ['des-advisor-ee', 'des-hod-ee', 'des-dean'],
      done: 3,
      submittedAgo: 2 * DAY,
      status: 'completed',
      formData: { purpose: 'Internship', organisation: 'K-Electric', start_date: dayOffset(250), end_date: dayOffset(305), details: 'Summer internship.' }
    })
  },
  demo({
    id: 'app-0407',
    ref: 'EZ-2026-0407',
    typeId: 'type-hostel-leave',
    studentId: 'student-hamza',
    chainIds: ['des-warden'],
    done: 0,
    submittedAgo: 3 * DAY,
    rejectAgo: 2 * DAY,
    rejectNote: 'dates clash with exams',
    status: 'rejected',
    formData: { room: 'Block C · Room 214', start_date: dayOffset(-1), end_date: dayOffset(1), destination: 'Lahore', guardian_phone: '+92 300 7654321' }
  })
];

// The approved NOC carries its issuance record; the PDF itself is rendered on
// first open and stored with the record.
(() => {
  const noc = INITIAL_APPLICATIONS.find(a => a.id === 'app-0398')!;
  const completedAt = noc.stageInstances[2].completedAt!;
  noc.updatedAt = completedAt;
  noc.timeline.push({
    id: 'tl-0398-iss',
    timestamp: completedAt,
    stageName: 'Issued',
    title: 'Fully approved · stamped PDF ready',
    description: 'All signatures stamped',
    actorName: 'EzScene',
    actorRole: 'system',
    type: 'issuance'
  });
  noc.issuedDocument = {
    id: 'doc-0398',
    documentNumber: 'EZ-2026-0398',
    referenceNumber: 'EZ-2026-0398',
    generatedAt: completedAt,
    verificationCode: 'EZ-2026-0398',
    documentHash: '9f2c81d0e4b7c3a1f55d0e9a2b7c6d1e8f3a4b5c6d7e8f9a0b1c2d3e4f5a71e0',
    appliedSignatures: noc.stageInstances.map(s => ({
      slotId: s.stageId,
      staffName: s.assignedStaffName!,
      roleTitle: s.assignedRole,
      timestamp: s.completedAt!,
      signatureUrl: s.signatureAssetUrl!
    })),
    appliedStamps: noc.stageInstances
      .filter(s => s.stampApplied && s.stampAssetUrl)
      .map(s => ({ slotId: s.stageId, stampName: `${s.assignedDepartment} seal`, timestamp: s.completedAt!, stampUrl: s.stampAssetUrl! }))
  };

  // A draft the student started earlier.
  const type = INITIAL_APPLICATION_TYPES.find(t => t.id === 'type-add-drop')!;
  const hamza = user('student-hamza');
  INITIAL_APPLICATIONS.push({
    id: 'app-draft-adddrop',
    referenceNumber: 'DRAFT',
    applicationTypeId: type.id,
    applicationTypeTitle: type.title,
    templateVersion: type.publishedVersion,
    studentId: hamza.id,
    studentSnapshot: snapshot(hamza),
    status: 'draft',
    currentStageId: '',
    currentStageIndex: 0,
    formData: { student_name: hamza.name, reg_no: hamza.registrationNumber, programme: hamza.semester, action: 'Add', course_code: 'EE-341', course_title: '' },
    uploadedDocuments: [],
    stageInstances: [],
    timeline: [],
    createdAt: ago(4 * DAY),
    updatedAt: ago(4 * DAY),
    source: 'form'
  });
})();

/* ---------------------------------------------------------- audit trail */

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'audit-seed-1', timestamp: ago(30 * DAY), actorId: 'admin-registrar', actorName: "Registrar's office", actorRole: 'admin', action: 'DESIGNATION_REASSIGNED', details: 'Coordinator → Engr. Bilal Ahmed' },
  { id: 'audit-seed-2', timestamp: ago(12 * DAY), actorId: 'admin-registrar', actorName: "Registrar's office", actorRole: 'admin', action: 'TEMPLATE_UPDATED', details: 'Leave Request v2 → v3' },
  ...INITIAL_APPLICATIONS.filter(a => a.status !== 'draft').flatMap(app =>
    app.timeline
      .filter(e => e.type === 'submission' || e.type === 'signature' || e.type === 'rejection')
      .map((e, i) => ({
        id: `audit-seed-${app.referenceNumber}-${i}`,
        timestamp: e.timestamp,
        actorId: e.type === 'submission' ? app.studentId : app.stageInstances.find(s => s.name === e.stageName)?.assignedStaffId || 'system',
        actorName: e.actorName,
        actorRole: e.type === 'submission' ? 'student' : e.actorRole,
        action: e.type === 'submission' ? 'APPLICATION_SUBMISSION' : e.type === 'signature' ? 'STAGE_SIGNED' : 'APPLICATION_REJECTED',
        details:
          e.type === 'submission'
            ? `${app.referenceNumber} · ${app.applicationTypeTitle}`
            : `${app.referenceNumber} · ${app.applicationTypeTitle}${e.type === 'rejection' ? ` — ${e.description}` : ''}`,
        applicationRef: app.referenceNumber
      }))
  )
].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-seed-1',
    userId: 'student-hamza',
    title: 'NOC · Internship is fully approved',
    message: 'All signatures stamped. Your print-ready PDF is ready to download.',
    type: 'success',
    read: false,
    createdAt: ago(2 * DAY - 6 * HOUR),
    applicationRef: 'EZ-2026-0398'
  },
  {
    id: 'notif-seed-2',
    userId: 'staff-ayesha',
    title: '4 requests are waiting for your signature',
    message: 'Leave Request, NOC, Semester Freeze and a custom upload are on your desk.',
    type: 'info',
    read: false,
    createdAt: ago(HOUR),
    applicationRef: 'EZ-2026-0412'
  }
];

export { ahead };
