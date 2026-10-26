import { describe, expect, it } from 'vitest';
import { boldSegments, daySpan, formatDate, renderDocumentText } from '../../src/lib/pdfGenerator';

const doc = {
  studentSnapshot: { name: 'Hamza Tariq', registrationNumber: '412345', email: 'h@x.pk', department: 'Electrical Engineering', phone: '' },
  formData: { reg_no: '412345', leave_type: 'Medical', start_date: '2026-11-18', end_date: '2026-11-20', reason: 'Fever' },
  referenceNumber: 'EZ-2026-0412',
  applicationTypeTitle: 'Leave Request',
  submissionDate: '2026-10-26T09:14:00Z',
  updatedAt: '2026-10-26T09:14:00Z'
};

describe('document text', () => {
  it('counts leave days inclusively', () => {
    expect(daySpan('2026-11-18', '2026-11-20')).toBe(3);
    expect(daySpan('2026-11-20', '2026-11-18')).toBe(0);
  });

  it('formats ISO dates the way the letter prints them', () => {
    expect(formatDate('2026-11-18')).toBe('18 Nov 2026');
  });

  it('fills tokens, lowercases on request and computes days', () => {
    const out = renderDocumentText('I, **{{student_name}}** ({{reg_no}}), request {{leave_type|lower}} leave from {{start_date}} to {{end_date}} ({{days}}).', doc);
    expect(out).toBe('I, **Hamza Tariq** (412345), request medical leave from 18 Nov 2026 to 20 Nov 2026 (3 days).');
  });

  it('marks missing fields with a blank line instead of leaking the token', () => {
    expect(renderDocumentText('Organisation: {{organisation}}', doc)).toBe('Organisation: ____');
  });

  it('splits bold runs', () => {
    expect(boldSegments('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false }
    ]);
  });
});
