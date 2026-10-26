import { beforeEach, describe, expect, it } from 'vitest';
import { EzStore } from '../../src/lib/store';
import { canSignStage, canViewApplication, isOnDesk } from '../../src/lib/access';

const s = EzStore;
const as = (id: string) => s.demoSignIn(id)!;
const d = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function submitLeave(days = 3) {
  as('student-hamza');
  return s.createApplication({
    applicationTypeId: 'type-leave',
    formData: { student_name: 'Hamza Tariq', reg_no: '412345', programme: 'BE Electrical Engineering, EE-15 A', leave_type: 'Medical', start_date: d(10), end_date: d(10 + days - 1), reason: 'Fever' },
    uploadedDocuments: [],
    designationIds: ['des-advisor-ee', 'des-hod-ee', 'des-dean']
  });
}

describe('approval workflow', () => {
  beforeEach(() => s.resetToDefaults());

  it('routes a request through every desk in order and issues it', async () => {
    const app = await submitLeave();
    expect(app.referenceNumber).toMatch(/^EZ-\d{4}-\d{4}$/);
    expect(app.stageInstances[0].assignedStaffId).toBe('staff-sana');

    for (const staff of ['staff-sana', 'staff-ayesha', 'staff-imran']) {
      as(staff);
      const current = s.getState().applications.find(a => a.id === app.id)!;
      expect(isOnDesk(s.getState().currentUser, current)).toBe(true);
      await s.processStageDecision({ applicationId: app.id, action: 'approve', decisionNotes: '' });
    }

    const done = s.getState().applications.find(a => a.id === app.id)!;
    expect(done.status).toBe('completed');
    expect(done.issuedDocument?.verificationCode).toBe(app.referenceNumber);
    // Student first (template includes it), then one block per signer.
    expect(done.issuedDocument?.appliedSignatures.map(x => x.roleTitle)).toEqual(['Student', 'Course Advisor', 'Head of Department', 'Dean']);
    // Head-level designations affix their department seal.
    expect(done.issuedDocument?.appliedStamps.length).toBe(2);
    expect(s.findIssued(app.referenceNumber)?.id).toBe(app.id);
  });

  it('refuses a decision from anyone but the current desk', async () => {
    const app = await submitLeave();
    as('staff-ayesha');
    await expect(s.processStageDecision({ applicationId: app.id, action: 'approve', decisionNotes: '' })).rejects.toThrow(/assigned/);
    as('admin-registrar');
    expect(canSignStage(s.getState().currentUser, app.stageInstances[0])).toBe(false);
  });

  it('needs a reason to reject and tells the student', async () => {
    const app = await submitLeave();
    as('staff-sana');
    await expect(s.processStageDecision({ applicationId: app.id, action: 'reject', decisionNotes: '  ' })).rejects.toThrow(/reason/);
    await s.processStageDecision({ applicationId: app.id, action: 'reject', decisionNotes: 'Clashes with exams' });
    const rejected = s.getState().applications.find(a => a.id === app.id)!;
    expect(rejected.status).toBe('rejected');
    expect(s.getState().notifications.some(n => n.userId === 'student-hamza' && /rejected/i.test(n.title))).toBe(true);
  });

  it('cannot approve without a saved signature', async () => {
    as('student-hamza');
    const app = await s.createApplication({ applicationTypeId: 'type-leave', formData: {}, uploadedDocuments: [], designationIds: ['des-assoc-hod-ee'] });
    as('staff-faisal'); // seeded without a signature
    await expect(s.processStageDecision({ applicationId: app.id, action: 'approve', decisionNotes: '' })).rejects.toThrow(/signature/);
  });

  it('moves pending requests when a designation is reassigned', async () => {
    as('admin-registrar');
    const moved = s.reassignDesignation('des-hod-ee', 'staff-faisal');
    expect(moved).toBeGreaterThan(0);
    const live = s.getState().applications.filter(a => a.stageInstances[a.currentStageIndex]?.designationId === 'des-hod-ee' && a.status === 'pending_signature');
    expect(live.every(a => a.stageInstances[a.currentStageIndex].assignedStaffId === 'staff-faisal')).toBe(true);
    // Already-applied signatures stay with the person who signed.
    const noc = s.getState().applications.find(a => a.id === 'app-0398')!;
    expect(noc.stageInstances.find(x => x.designationId === 'des-hod-ee')!.actionTakenBy).toBe('Dr. Ayesha Malik');
  });

  it('limits who can see a request', async () => {
    const app = await submitLeave();
    const users = s.getState().users;
    expect(canViewApplication(users.find(u => u.id === 'student-mahnoor'), app)).toBe(false);
    expect(canViewApplication(users.find(u => u.id === 'staff-sana'), app)).toBe(true);
    expect(canViewApplication(users.find(u => u.id === 'staff-ghani'), app)).toBe(false);
    expect(canViewApplication(users.find(u => u.id === 'admin-registrar'), app)).toBe(true);
  });
});

describe('audit log', () => {
  beforeEach(() => s.resetToDefaults());

  it('is hash-chained and detects an edited entry', async () => {
    await submitLeave();
    expect(s.verifyAuditChain().ok).toBe(true);
    const logs = s.getState().auditLogs;
    logs[3] = { ...logs[3], details: 'edited after the fact' };
    const result = s.verifyAuditChain();
    expect(result.ok).toBe(false);
    expect(result.brokenId).toBe(logs[3].id);
  });
});

describe('password reset', () => {
  beforeEach(() => s.resetToDefaults());

  it('only accepts the issued code, then changes the password', async () => {
    const r = s.requestPasswordReset('hamza.tariq@student.uni.edu.pk');
    expect(r.ok).toBe(true);
    expect(s.verifyResetCode('hamza.tariq@student.uni.edu.pk', '000000').ok).toBe(r.code === '000000');
    expect(s.verifyResetCode('hamza.tariq@student.uni.edu.pk', r.code!).ok).toBe(true);
    expect(s.completePasswordReset('hamza.tariq@student.uni.edu.pk', 'newpass1').ok).toBe(true);
    expect((await s.authenticate('hamza.tariq@student.uni.edu.pk', '123', { role: 'student', cmsId: '412345' })).ok).toBe(false);
    expect((await s.authenticate('hamza.tariq@student.uni.edu.pk', 'newpass1', { role: 'student', cmsId: '412345' })).ok).toBe(true);
  });
});
