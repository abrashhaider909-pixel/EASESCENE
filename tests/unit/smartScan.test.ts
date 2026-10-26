import { describe, expect, it } from 'vitest';
import { suggestForForm, suggestForUpload } from '../../src/lib/smartScan';
import { INITIAL_APPLICATION_TYPES, INITIAL_DESIGNATIONS, INITIAL_USERS } from '../../src/lib/constants';

const hamza = INITIAL_USERS.find(u => u.id === 'student-hamza')!;
const leave = INITIAL_APPLICATION_TYPES.find(t => t.key === 'leave-request')!;
const title = (id: string) => INITIAL_DESIGNATIONS.find(d => d.id === id)!.title;

describe('smart scan', () => {
  it('suggests Advisor → HoD for a short leave', () => {
    const r = suggestForForm(leave, { start_date: '2026-11-18', end_date: '2026-11-19' }, hamza, INITIAL_DESIGNATIONS);
    expect(r.designationIds.map(title)).toEqual(['Course Advisor', 'Head of Department']);
  });

  it('adds the Dean for leave of 3 or more days and says why', () => {
    const r = suggestForForm(leave, { start_date: '2026-11-18', end_date: '2026-11-20' }, hamza, INITIAL_DESIGNATIONS);
    expect(r.designationIds.map(title)).toEqual(['Course Advisor', 'Head of Department', 'Dean']);
    expect(r.reasons.join(' ')).toMatch(/3 or more days/);
    expect(r.tags).toContain('3 days');
  });

  it('uses the student’s own department for department designations', () => {
    const csStudent = { ...hamza, department: 'Computer Science' };
    const r = suggestForForm(leave, {}, csStudent, INITIAL_DESIGNATIONS);
    expect(r.designationIds).toContain('des-advisor-cs');
    expect(r.designationIds).toContain('des-hod-cs');
  });

  it('reads an uploaded NOC and routes it to the Dean', () => {
    const r = suggestForUpload('NOC internship request.pdf', 'No objection certificate for internship', hamza, INITIAL_DESIGNATIONS, INITIAL_APPLICATION_TYPES);
    expect(r.designationIds.map(title)).toEqual(['Course Advisor', 'Head of Department', 'Dean']);
    expect(r.detectedTypeId).toBe('type-noc');
  });

  it('falls back to Advisor → HoD when nothing matches', () => {
    const r = suggestForUpload('scan001.pdf', '', hamza, INITIAL_DESIGNATIONS, INITIAL_APPLICATION_TYPES);
    expect(r.designationIds.map(title)).toEqual(['Course Advisor', 'Head of Department']);
  });
});
