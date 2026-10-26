import { useEffect, useRef, useState } from 'react';
import { RotateCcw, X, Upload } from 'lucide-react';
import { Button, cx, Segmented, readFileAsDataUrl } from './kit';
import { processTransparentAsset } from '../lib/imageProcessor';
import { toast } from '../lib/toast';

const INKS = [
  { id: 'black', color: '#111111', label: 'Black ink' },
  { id: 'navy', color: '#1B2A6B', label: 'Blue ink' }
];

/** Trim transparent margins and return a PNG data URL (or null when empty). */
function exportTrimmed(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxX - minX < 12) return null;
  const pad = 8;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(canvas, minX - pad, minY - pad, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}

export function SignaturePad({ onSave, saving, compact, cta = 'Save signature' }: { onSave: (dataUrl: string, source: 'draw' | 'upload') => void; saving?: boolean; compact?: boolean; cta?: string }) {
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [ink, setInk] = useState(INKS[0].color);
  const [hasInk, setHasInk] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const p = point(e);
    const pressure = e.pressure && e.pressure !== 0.5 ? e.pressure : 0.6;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6 + pressure * 2.2;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!/image\/(png|jpe?g)/.test(file.type)) {
      toast('error', 'Use a PNG or JPG image');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast('error', 'Image is too large', 'Keep signature images under 3 MB.');
      return;
    }
    const raw = await readFileAsDataUrl(file);
    try {
      const { processedDataUrl } = await processTransparentAsset(raw, { removeWhiteBackground: true, whiteThreshold: 225, smoothEdges: true, cropMargins: true, opacity: 1 });
      setUploaded(processedDataUrl);
    } catch {
      setUploaded(raw);
    }
  };

  const save = () => {
    if (mode === 'draw') {
      const c = canvasRef.current;
      const url = c ? exportTrimmed(c) : null;
      if (!url) {
        toast('warning', 'Sign above the line first');
        return;
      }
      onSave(url, 'draw');
    } else if (uploaded) {
      onSave(uploaded, 'upload');
    } else {
      toast('warning', 'Choose a PNG first');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Signature input"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'draw', label: 'Draw' },
          { value: 'upload', label: 'Upload PNG' }
        ]}
      />
      {mode === 'draw' ? (
        <>
          <div className="relative bg-white border border-line rounded-[14px]" style={{ height: compact ? 200 : 230 }}>
            <canvas
              ref={canvasRef}
              aria-label="Signature drawing area. Draw with your finger, stylus or mouse."
              className="absolute inset-0 w-full h-full touch-none rounded-[14px]"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
            />
            <div className="pointer-events-none absolute left-5 right-5 bottom-11 border-t border-dashed border-mauve/50" />
            <span aria-hidden className="pointer-events-none absolute left-5 bottom-[52px] text-mauve/60">
              <X size={14} />
            </span>
            <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-mauve">Sign above the line</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2.5" role="radiogroup" aria-label="Ink colour">
              {INKS.map(i => (
                <button
                  key={i.id}
                  role="radio"
                  aria-checked={ink === i.color}
                  aria-label={i.label}
                  onClick={() => setInk(i.color)}
                  className={cx('w-11 h-11 rounded-full border-[3px]', ink === i.color ? 'border-cyan ring-2 ring-ink' : 'border-white ring-1 ring-line')}
                  style={{ background: i.color }}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={clear} disabled={!hasInk}>
              <RotateCcw size={16} /> Clear
            </Button>
          </div>
        </>
      ) : (
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-teal/60 bg-sky/50 rounded-[14px] cursor-pointer text-center p-4" style={{ minHeight: compact ? 200 : 230 }}>
          {uploaded ? (
            <span className="checker rounded-[10px] p-3 w-full flex justify-center">
              <img src={uploaded} alt="Uploaded signature" className="max-h-28 object-contain" />
            </span>
          ) : (
            <Upload size={30} />
          )}
          <span className="font-bold">{uploaded ? 'Choose a different image' : 'Choose a PNG or JPG of your signature'}</span>
          <span className="text-sm text-mauve">White backgrounds are removed automatically.</span>
          <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={e => onFile(e.target.files?.[0])} />
        </label>
      )}
      <Button size="lg" onClick={save} loading={saving} className="w-full">
        {cta}
      </Button>
    </div>
  );
}
