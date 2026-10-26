/**
 * Browser download helper.
 * Inside a hosted preview frame (window.claude present) files are offered
 * through the viewer's download capability; on a normal website a Blob URL
 * link is used.
 */
import { toast } from './toast';

export const inHostedViewer = () => typeof window !== 'undefined' && typeof (window as any).claude?.use === 'function';

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'application/octet-stream';
  const payload = dataUrl.slice(comma + 1);
  if (!meta.includes('base64')) return new Blob([decodeURIComponent(payload)], { type: mime });
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (inHostedViewer()) {
    try {
      const downloads = await (window as any).claude.use('downloads');
      if (downloads) {
        await downloads.save({ filename, data: blob });
        return;
      }
      toast('warning', 'Downloads aren’t available here', 'Open the deployed site to download files.');
      return;
    } catch (e: any) {
      if (e?.code === 'declined') return;
      toast('warning', 'Download didn’t start', e?.message || 'Try again.');
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  try {
    void downloadBlob(dataUrlToBlob(dataUrl), filename);
  } catch {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.click();
  }
}
