/**
 * In-progress request being composed across the New application → form →
 * approval chain steps. Kept in sessionStorage so a refresh doesn't lose it.
 */
import { UploadedDocument } from '../types';
import type { ScanResult } from './smartScan';

export interface Composition {
  typeId: string;
  source: 'form' | 'upload';
  formData: Record<string, any>;
  uploadedDocuments: UploadedDocument[];
  draftId?: string;
  resubmitId?: string;
  scan?: ScanResult;
  chain?: string[];
}

const KEY = 'ezscene_composer';
let memory: Composition | null = null;

export function getComposition(): Composition | null {
  if (memory) return memory;
  try {
    const raw = sessionStorage.getItem(KEY);
    memory = raw ? JSON.parse(raw) : null;
  } catch {
    memory = null;
  }
  return memory;
}

export function setComposition(c: Composition | null) {
  memory = c;
  try {
    if (c) sessionStorage.setItem(KEY, JSON.stringify(c));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* large uploads may exceed sessionStorage; memory copy still works */
  }
}
