/**
 * EzScene access rules
 * ---------------------------------------------------------------------------
 * Students   see and act on their own requests only.
 * Faculty    see requests whose approval chain includes them; they can decide
 *            only on the stage currently assigned to them, and every approval
 *            stamps *their own* saved signature (never a colleague's).
 * Admin      sees every record, manages designations/templates/accounts and
 *            verifies documents, but never signs (separation of duties).
 *
 * Both the UI and the store call these helpers, so the rules cannot drift.
 */

import { Application, SignatureAsset, StampAsset, UserProfile, Designation } from '../types';

export function currentStage(app: Application) {
  return app.stageInstances[app.currentStageIndex];
}

/** Is this request live on this user's desk right now? */
export function isOnDesk(user: UserProfile | null | undefined, app: Application): boolean {
  if (!user || user.role !== 'staff') return false;
  if (!['submitted', 'under_verification', 'pending_approval', 'pending_signature', 'overdue'].includes(app.status)) return false;
  const stage = currentStage(app);
  return Boolean(stage && stage.status === 'in_progress' && stage.assignedStaffId === user.id);
}

/** Who may record a decision on the live stage. */
export function canWorkStage(user: UserProfile | null | undefined, app: Application): boolean {
  return isOnDesk(user, app);
}

/** Signing authority for one stage: only the person it is assigned to. */
export function canSignStage(
  user: UserProfile | null | undefined,
  stage: { assignedStaffId?: string } | null | undefined
): boolean {
  if (!user || !stage || user.role !== 'staff') return false;
  return Boolean(stage.assignedStaffId && stage.assignedStaffId === user.id);
}

/** Read access to a request (documents, trail, PDF). */
export function canViewApplication(user: UserProfile | null | undefined, app: Application): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'student') return app.studentId === user.id;
  return app.stageInstances.some(s => s.assignedStaffId === user.id && (s.status !== 'pending' || s.startedAt));
}

/** Backwards-compatible alias. */
export const canReviewRecord = canViewApplication;

/** The user's own active saved signature (most recent first). */
export function ownSignature(user: UserProfile | null | undefined, assets: SignatureAsset[]): SignatureAsset | undefined {
  if (!user) return undefined;
  return assets
    .filter(
      a =>
        a.active &&
        (a.ownerId ? a.ownerId === user.id : a.ownerName.trim().toLowerCase() === user.name.trim().toLowerCase())
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function availableSignatures(user: UserProfile | null | undefined, assets: SignatureAsset[]): SignatureAsset[] {
  const own = ownSignature(user, assets);
  return own ? [own] : [];
}

/** Department seal affixed alongside a head-level designation's signature. */
export function sealFor(designation: Designation | undefined, stamps: StampAsset[]): StampAsset | undefined {
  if (!designation?.affixesSeal) return undefined;
  return stamps.find(s => s.active && s.department === designation.department);
}

/** Designations a student can add to their chain. */
export function designationsForStudent(student: UserProfile | null | undefined, all: Designation[]): Designation[] {
  return all
    .filter(d => d.holderId && (d.reach === 'university' || d.department === student?.department))
    .sort((a, b) => a.order - b.order);
}
