/**
 * SLA Calculation & Automated Escalation Engine
 * Accounts for business hours (09:00 - 17:00 Mon-Fri) and calculates
 * target deadlines, remaining time, warning levels, and idempotent escalations.
 */

import { Application, ApplicationStageInstance, TimelineEvent, NotificationItem } from '../types';

export interface SLAStatus {
  isOverdue: boolean;
  isApproaching: boolean; // within 20% of remaining time
  hoursRemaining: number;
  hoursOverdue: number;
  formattedRemaining: string;
  warningLevel: 0 | 1 | 2 | 3; // 0: normal, 1: first warning, 2: second warning, 3: escalated to admin
  deadlineFormatted: string;
}

/**
 * Calculates deadline date by adding business hours (09:00 - 17:00, Mon-Fri)
 */
export function addBusinessHours(startDate: Date, hoursToAdd: number): Date {
  const current = new Date(startDate.getTime());
  let remainingHours = hoursToAdd;

  // Working day boundaries
  const START_HOUR = 9;
  const END_HOUR = 17;
  const WORK_HOURS_PER_DAY = END_HOUR - START_HOUR; // 8 hours

  while (remainingHours > 0) {
    const day = current.getDay(); // 0 is Sunday, 6 is Saturday

    // If weekend, skip to Monday 09:00
    if (day === 0) { // Sunday
      current.setDate(current.getDate() + 1);
      current.setHours(START_HOUR, 0, 0, 0);
      continue;
    } else if (day === 6) { // Saturday
      current.setDate(current.getDate() + 2);
      current.setHours(START_HOUR, 0, 0, 0);
      continue;
    }

    const currentHour = current.getHours() + current.getMinutes() / 60;

    // If before working hours, jump to 09:00
    if (currentHour < START_HOUR) {
      current.setHours(START_HOUR, 0, 0, 0);
      continue;
    }

    // If after working hours, jump to next day 09:00
    if (currentHour >= END_HOUR) {
      current.setDate(current.getDate() + 1);
      current.setHours(START_HOUR, 0, 0, 0);
      continue;
    }

    // Hours remaining today in working day
    const hoursLeftToday = END_HOUR - currentHour;

    if (remainingHours <= hoursLeftToday) {
      current.setTime(current.getTime() + remainingHours * 60 * 60 * 1000);
      remainingHours = 0;
    } else {
      remainingHours -= hoursLeftToday;
      current.setDate(current.getDate() + 1);
      current.setHours(START_HOUR, 0, 0, 0);
    }
  }

  return current;
}

/**
 * Evaluates the SLA status of an active application stage
 */
export function evaluateStageSLA(stage: ApplicationStageInstance): SLAStatus {
  if (!stage.startedAt || !stage.deadline) {
    return {
      isOverdue: false,
      isApproaching: false,
      hoursRemaining: stage.slaHours || 24,
      hoursOverdue: 0,
      formattedRemaining: `${stage.slaHours || 24}h remaining`,
      warningLevel: 0,
      deadlineFormatted: 'Pending schedule'
    };
  }

  const now = new Date();
  const deadlineDate = new Date(stage.deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const isOverdue = diffHours < 0;
  const hoursOverdue = isOverdue ? Math.abs(Math.round(diffHours * 10) / 10) : 0;
  const hoursRemaining = !isOverdue ? Math.round(diffHours * 10) / 10 : 0;

  // Total allocated duration
  const startDate = new Date(stage.startedAt);
  const totalAllocatedHours = (deadlineDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  const isApproaching = !isOverdue && diffHours <= Math.max(4, totalAllocatedHours * 0.25);

  // Determine warning level based on overdue duration and recorded warningCount
  let warningLevel: 0 | 1 | 2 | 3 = 0;
  if (isOverdue) {
    if (hoursOverdue >= 24 || stage.warningCount >= 3) {
      warningLevel = 3; // Escalated
    } else if (hoursOverdue >= 8 || stage.warningCount === 2) {
      warningLevel = 2; // Warning 2
    } else {
      warningLevel = 1; // Warning 1
    }
  }

  const formattedRemaining = isOverdue
    ? `${hoursOverdue}h overdue`
    : `${hoursRemaining > 24 ? Math.floor(hoursRemaining / 24) + 'd ' : ''}${Math.round(hoursRemaining % 24)}h remaining`;

  return {
    isOverdue,
    isApproaching,
    hoursRemaining,
    hoursOverdue,
    formattedRemaining,
    warningLevel,
    deadlineFormatted: deadlineDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };
}

/**
 * Runs an SLA scheduler pass across all active applications.
 * Idempotently creates warning timeline events and notifications.
 */
export function runSLASchedulerCheck(
  applications: Application[],
  onUpdateApp: (updated: Application) => void,
  onAddNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt'>) => void
): { checkedCount: number; warningsGenerated: number; escalationsTriggered: number } {
  let warningsGenerated = 0;
  let escalationsTriggered = 0;
  let checkedCount = 0;

  const nowIso = new Date().toISOString();

  applications.forEach(app => {
    // Only check applications currently in an active processing stage
    if (
      app.status === 'completed' ||
      app.status === 'rejected' ||
      app.status === 'cancelled' ||
      app.status === 'draft'
    ) {
      return;
    }

    const currentStage = app.stageInstances[app.currentStageIndex];
    if (!currentStage || currentStage.status === 'completed') return;

    checkedCount++;
    const sla = evaluateStageSLA(currentStage);

    if (sla.isOverdue) {
      let needsUpdate = false;
      const updatedStage = { ...currentStage };
      const updatedTimeline = [...app.timeline];

      if (sla.warningLevel === 1 && currentStage.warningCount < 1) {
        updatedStage.warningCount = 1;
        needsUpdate = true;
        warningsGenerated++;

        // Add timeline event
        updatedTimeline.push({
          id: `warn-1-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          stageName: currentStage.name,
          title: 'SLA Warning 1: Processing Deadline Reached',
          description: `Stage "${currentStage.name}" is overdue by ${sla.hoursOverdue}h. Assigned officer notified.`,
          actorName: 'SLA Scheduler Engine',
          actorRole: 'system',
          type: 'warning'
        });

        // Notify the directly assigned staff member only (skip if unassigned —
        // the admin escalation at level 3 always fires regardless).
        if (currentStage.assignedStaffId) {
          onAddNotification({
            userId: currentStage.assignedStaffId,
            title: `Overdue Notice: ${app.referenceNumber}`,
            message: `Application ${app.referenceNumber} (${app.applicationTypeTitle}) in stage "${currentStage.name}" has exceeded SLA deadline.`,
            type: 'warning',
            read: false,
            applicationRef: app.referenceNumber
          });
        }
      } else if (sla.warningLevel === 2 && currentStage.warningCount < 2) {
        updatedStage.warningCount = 2;
        needsUpdate = true;
        warningsGenerated++;

        updatedTimeline.push({
          id: `warn-2-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          stageName: currentStage.name,
          title: 'SLA Warning 2: Persistent Delay Follow-Up',
          description: `Stage "${currentStage.name}" remains incomplete (${sla.hoursOverdue}h overdue). Escalation pending.`,
          actorName: 'SLA Scheduler Engine',
          actorRole: 'system',
          type: 'warning'
        });

        if (currentStage.assignedStaffId) {
          onAddNotification({
            userId: currentStage.assignedStaffId,
            title: `Urgent Warning 2: ${app.referenceNumber}`,
            message: `Immediate action required on ${app.referenceNumber}. Next overdue threshold will trigger Administrator escalation.`,
            type: 'warning',
            read: false,
            applicationRef: app.referenceNumber
          });
        }
      } else if (sla.warningLevel === 3 && currentStage.warningCount < 3) {
        updatedStage.warningCount = 3;
        updatedStage.status = 'escalated';
        needsUpdate = true;
        escalationsTriggered++;

        updatedTimeline.push({
          id: `escalate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          stageName: currentStage.name,
          title: 'SLA Warning 3: Formal Administrative Escalation',
          description: `Processing delay exceeded 24 hours overdue. Case automatically escalated to University Academic Registrar for expedited resolution.`,
          actorName: 'SLA Scheduler Engine',
          actorRole: 'system',
          type: 'escalation'
        });

        // Notify Admin
        onAddNotification({
          userId: 'admin-registrar',
          title: `Administrator Escalation: ${app.referenceNumber}`,
          message: `Application ${app.referenceNumber} has been escalated to Administrator due to 3 missed SLA deadlines in stage "${currentStage.name}".`,
          type: 'alert',
          read: false,
          applicationRef: app.referenceNumber
        });
      }

      if (needsUpdate) {
        const updatedStages = [...app.stageInstances];
        updatedStages[app.currentStageIndex] = updatedStage;

        onUpdateApp({
          ...app,
          status: 'overdue',
          stageInstances: updatedStages,
          timeline: updatedTimeline,
          updatedAt: nowIso
        });
      }
    }
  });

  return { checkedCount, warningsGenerated, escalationsTriggered };
}
