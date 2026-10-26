/**
 * Smart scan
 * ---------------------------------------------------------------------------
 * Reads what the student filled (or the text inside an uploaded PDF / Word
 * file) and suggests an approval chain with plain-language reasons. Runs fully
 * in the browser: PDF content streams are inflated with DecompressionStream,
 * and .docx files are unzipped to read word/document.xml.
 */

import { ApplicationType, Designation, UserProfile } from '../types';
import { daySpan } from './pdfGenerator';

export interface ScanResult {
  tags: string[];
  reasons: string[];
  designationIds: string[];
  detectedTypeId?: string;
}

/* ------------------------------------------------------- text extraction */

async function inflate(bytes: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
};

function textOperators(content: string): string {
  const out: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")|\[((?:\((?:\\.|[^\\)])*\)|[^\]])*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const chunk = m[0];
    const strings = chunk.match(/\((?:\\.|[^\\)])*\)/g) || [];
    out.push(strings.map(s => s.slice(1, -1).replace(/\\([nrt()\\])/g, (_x, c) => ({ n: ' ', r: ' ', t: ' ' } as any)[c] ?? c)).join(''));
  }
  return out.join(' ');
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const raw = latin1(bytes);
  const parts: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let budget = 60;
  while ((m = re.exec(raw)) && budget-- > 0) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const header = raw.slice(Math.max(0, m.index - 200), m.index);
    const body = bytes.subarray(start, end);
    if (/FlateDecode/.test(header)) {
      const inflated = await inflate(body, 'deflate');
      if (inflated) parts.push(textOperators(latin1(inflated)));
    } else if (!/Image|DCTDecode/.test(header)) {
      parts.push(textOperators(latin1(body)));
    }
    re.lastIndex = end;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.length - 30; i += 1) {
    if (view.getUint32(i, true) !== 0x04034b50) continue;
    const method = view.getUint16(i + 8, true);
    const compSize = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const name = latin1(bytes.subarray(i + 30, i + 30 + nameLen));
    const dataStart = i + 30 + nameLen + extraLen;
    if (name === 'word/document.xml') {
      const data = bytes.subarray(dataStart, dataStart + compSize);
      const xmlBytes = method === 8 ? await inflate(data, 'deflate-raw') : data;
      if (!xmlBytes) return '';
      const xml = new TextDecoder().decode(xmlBytes);
      return xml.replace(/<\/w:p>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }
    i = dataStart + compSize - 1;
  }
  return '';
}

/** Best-effort text from an uploaded file; empty string when unreadable. */
export async function extractText(file: { fileDataUrl: string; fileType: string; fileName: string }): Promise<string> {
  try {
    const b64 = file.fileDataUrl.slice(file.fileDataUrl.indexOf(',') + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    if (file.fileType === 'application/pdf' || /\.pdf$/i.test(file.fileName)) return (await pdfText(bytes)).slice(0, 8000);
    if (/\.docx$/i.test(file.fileName)) return (await docxText(bytes)).slice(0, 8000);
  } catch {
    /* unreadable */
  }
  return '';
}

/* ------------------------------------------------------------ suggestion */

/** Map a template's default designation to the student's own department equivalent. */
function localise(d: Designation | undefined, student: UserProfile, all: Designation[]): Designation | undefined {
  if (!d) return undefined;
  if (d.reach === 'university' || d.department === student.department) return d;
  return all.find(x => x.title === d.title && x.department === student.department && x.holderId) || d;
}

function byTitle(title: string, student: UserProfile, all: Designation[]): Designation | undefined {
  const local = all.find(d => d.title === title && d.department === student.department && d.holderId);
  return local || all.find(d => d.title === title && d.reach === 'university' && d.holderId);
}

export function suggestForForm(type: ApplicationType, formData: Record<string, any>, student: UserProfile, all: Designation[]): ScanResult {
  const ids: string[] = [];
  const reasons: string[] = [];
  const tags: string[] = [type.title.replace(' Request', ' application').replace('Leave application', 'Leave application')];
  type.workflowDefinition.stages.forEach(s => {
    const d = localise(all.find(x => x.id === s.designationId), student, all);
    if (d && !ids.includes(d.id)) ids.push(d.id);
  });
  const titles = ids.map(id => all.find(d => d.id === id)?.title);
  if (titles[0]) reasons.push(`${type.title} requests start with your ${titles[0]}.`);
  if (titles.includes('Head of Department')) reasons.push('Addressed to the Head of Department.');

  const days = daySpan(formData.start_date, formData.end_date);
  if (days) tags.push(`${days} day${days === 1 ? '' : 's'}`);
  if (formData.leave_type) tags.push(String(formData.leave_type));
  if (formData.purpose) tags.push(String(formData.purpose));
  tags.push(student.department);

  if (type.key === 'leave-request' && days >= 3) {
    const dean = byTitle('Dean', student, all);
    if (dean && !ids.includes(dean.id)) {
      ids.push(dean.id);
      reasons.push('Leave of 3 or more days is also sent to the Dean.');
    }
  }
  if (type.key === 'clearance' && formData.hostel_resident === 'No') {
    const warden = byTitle('Hostel Warden', student, all);
    if (warden && ids.includes(warden.id)) {
      ids.splice(ids.indexOf(warden.id), 1);
      reasons.push('Not a hostel resident, so the Hostel Warden is skipped.');
    }
  }
  return { tags, reasons, designationIds: ids, detectedTypeId: type.id };
}

const RULES: { re: RegExp; tag: string; chain: string[]; reason: string; typeKey?: string }[] = [
  { re: /\b(no[- ]objection|noc|internship|visa)\b/i, tag: 'NOC', chain: ['Course Advisor', 'Head of Department', 'Dean'], reason: 'NOCs need the department’s and the Dean’s consent.', typeKey: 'noc' },
  { re: /\b(clearance|degree completion|graduation|convocation)\b/i, tag: 'Clearance', chain: ['Coordinator', 'Hostel Warden', 'Registrar'], reason: 'Degree-end clearance goes through the coordinator, hostel and registrar.', typeKey: 'clearance' },
  { re: /\b(freeze|semester break|defer)\b/i, tag: 'Semester freeze', chain: ['Course Advisor', 'Head of Department', 'Dean', 'Registrar'], reason: 'Freezing a semester is recorded by the Registrar.', typeKey: 'semester-freeze' },
  { re: /\b(hostel|warden|room)\b/i, tag: 'Hostel', chain: ['Hostel Warden'], reason: 'Hostel matters are decided by the Hostel Warden.', typeKey: 'hostel-leave' },
  { re: /\b(leave|absence|absent|sick|medical)\b/i, tag: 'Leave application', chain: ['Course Advisor', 'Head of Department'], reason: 'Leave applications start with your Course Advisor and go to the Head of Department.', typeKey: 'leave-request' },
  { re: /\b(add|drop|course registration|credit hours?)\b/i, tag: 'Course change', chain: ['Course Advisor', 'Coordinator'], reason: 'Course changes are approved by your advisor and the programme coordinator.', typeKey: 'course-add-drop' },
  { re: /\b(transcript|degree verification|fee|scholarship|refund)\b/i, tag: 'Records', chain: ['Registrar'], reason: 'Records and fee letters are issued by the Registrar.' },
  { re: /\b(lab|laboratory|equipment|head of department|hod)\b/i, tag: 'Department', chain: ['Head of Department'], reason: 'Addressed to the Head of Department.' }
];

export function suggestForUpload(fileName: string, text: string, student: UserProfile, all: Designation[], types: ApplicationType[]): ScanResult {
  const haystack = `${fileName.replace(/[_\-.]+/g, ' ')} ${text}`;
  const tags: string[] = [];
  const reasons: string[] = [];
  const titles: string[] = [];
  let detectedTypeId: string | undefined;
  for (const rule of RULES) {
    if (!rule.re.test(haystack)) continue;
    tags.push(rule.tag);
    reasons.push(rule.reason);
    rule.chain.forEach(t => !titles.includes(t) && titles.push(t));
    if (!detectedTypeId && rule.typeKey) detectedTypeId = types.find(t => t.key === rule.typeKey)?.id;
    if (titles.length >= 3) break;
  }
  if (!titles.length) {
    titles.push('Course Advisor', 'Head of Department');
    reasons.push('No specific form detected, so it goes to your Course Advisor and Head of Department.');
  }
  const days = /\b(\d{1,2})\s*(?:days?)\b/i.exec(haystack);
  if (days) {
    tags.push(`${days[1]} days`);
    if (Number(days[1]) >= 3 && tags.includes('Leave application') && !titles.includes('Dean')) {
      titles.push('Dean');
      reasons.push('Leave of 3 or more days is also sent to the Dean.');
    }
  }
  if (/\b(dean)\b/i.test(haystack) && !titles.includes('Dean')) {
    titles.push('Dean');
    reasons.push('The document is addressed to the Dean.');
  }
  tags.push(student.department);
  const ids = titles.map(t => byTitle(t, student, all)?.id).filter((x): x is string => Boolean(x));
  return { tags: Array.from(new Set(tags)), reasons, designationIds: Array.from(new Set(ids)), detectedTypeId };
}
