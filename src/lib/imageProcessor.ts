/**
 * Image Processing Engine for Transparent Signatures & Official Stamps
 * Provides canvas-based background transparency extraction, thresholding, edge antialiasing,
 * and margin cropping without degrading seal crest details.
 */

export interface ProcessImageOptions {
  removeWhiteBackground: boolean;
  whiteThreshold: number; // 0 to 255 (typically 220-250)
  smoothEdges: boolean;
  cropMargins: boolean;
  cropBox?: { x: number; y: number; width: number; height: number };
  opacity: number; // 0.1 to 1.0
}

/**
 * Loads an image from a URL or DataURL into an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

/**
 * Detects the bounding box of non-empty content in canvas data
 */
export function detectContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  whiteThreshold: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Pixel is considered content if it's not transparent and not white
      const isWhite = r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
      const isContent = a > 20 && !isWhite;

      if (isContent) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) {
    return { minX: 0, minY: 0, maxX: width, maxY: height };
  }

  // Add 4px safety padding
  return {
    minX: Math.max(0, minX - 4),
    minY: Math.max(0, minY - 4),
    maxX: Math.min(width, maxX + 4),
    maxY: Math.min(height, maxY + 4)
  };
}

/**
 * Removes white backgrounds and processes transparency on canvas
 */
export async function processTransparentAsset(
  sourceUrl: string,
  options: ProcessImageOptions
): Promise<{ processedDataUrl: string; bounds: { width: number; height: number } }> {
  const img = await loadImage(sourceUrl);
  
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Draw original image
  ctx.drawImage(img, 0, 0);

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Process transparency if requested
  if (options.removeWhiteBackground) {
    const threshold = options.whiteThreshold;
    const featherRange = 25; // Gradual fade for soft ink edges

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a === 0) continue;

      // Calculate perceived brightness / luminance
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      if (brightness >= threshold) {
        // Pure transparent for pixels over threshold
        data[i + 3] = 0;
      } else if (options.smoothEdges && brightness > threshold - featherRange) {
        // Smooth transition edge
        const ratio = (threshold - brightness) / featherRange;
        data[i + 3] = Math.round(a * Math.max(0, Math.min(1, ratio)));
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // 2. Crop if requested
  let cropX = 0;
  let cropY = 0;
  let cropW = width;
  let cropH = height;

  if (options.cropMargins) {
    const bounds = detectContentBounds(ctx, width, height, options.whiteThreshold);
    cropX = bounds.minX;
    cropY = bounds.minY;
    cropW = Math.max(1, bounds.maxX - bounds.minX);
    cropH = Math.max(1, bounds.maxY - bounds.minY);
  } else if (options.cropBox) {
    cropX = options.cropBox.x;
    cropY = options.cropBox.y;
    cropW = options.cropBox.width;
    cropH = options.cropBox.height;
  }

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    throw new Error('Cropped canvas context not available');
  }

  // Apply opacity
  if (options.opacity < 1.0) {
    croppedCtx.globalAlpha = options.opacity;
  }

  croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return {
    processedDataUrl: croppedCanvas.toDataURL('image/png'),
    bounds: { width: cropW, height: cropH }
  };
}

/**
 * Generates an SVG DataURL for authentic university official stamps
 */
export function generateOfficialStampSvg(
  universityName: string,
  departmentName: string,
  serialNumber: string,
  color: string = '#172b50',
  opacity: number = 0.88
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <defs>
    <!-- Curved path for top text -->
    <path id="topCurve" d="M 30,120 A 90,90 0 0,1 210,120" fill="none" />
    <!-- Curved path for bottom text -->
    <path id="bottomCurve" d="M 210,120 A 90,90 0 0,1 30,120" fill="none" />
  </defs>
  
  <g opacity="${opacity}">
    <!-- Outer thick circular ring -->
    <circle cx="120" cy="120" r="108" fill="none" stroke="${color}" stroke-width="4.5" stroke-dasharray="0" />
    <!-- Outer thin ring -->
    <circle cx="120" cy="120" r="102" fill="none" stroke="${color}" stroke-width="1.5" />
    <!-- Inner circular ring -->
    <circle cx="120" cy="120" r="68" fill="none" stroke="${color}" stroke-width="2" />
    <circle cx="120" cy="120" r="63" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="3,2" />

    <!-- Top curved university text -->
    <text fill="${color}" font-family="Plus Jakarta Sans, sans-serif" font-size="11.5" font-weight="700" letter-spacing="2.2">
      <textPath href="#topCurve" startOffset="50%" text-anchor="middle">
        ${universityName.toUpperCase()}
      </textPath>
    </text>

    <!-- Bottom curved department text -->
    <text fill="${color}" font-family="Plus Jakarta Sans, sans-serif" font-size="10.5" font-weight="600" letter-spacing="1.8">
      <textPath href="#bottomCurve" startOffset="50%" text-anchor="middle">
        ${departmentName.toUpperCase()}
      </textPath>
    </text>

    <!-- Center crest & verification text -->
    <g transform="translate(120, 102)" text-anchor="middle">
      <!-- Shield / Crest icon -->
      <path d="M-14,-14 L14,-14 Q14,4 0,16 Q-14,4 -14,-14 Z" fill="none" stroke="${color}" stroke-width="2" />
      <path d="M-8,-8 L8,-8 Q8,2 0,10 Q-8,2 -8,-8 Z" fill="${color}" opacity="0.15" />
      <path d="M-5,0 L-1,4 L6,-4" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- Center text -->
    <text x="120" y="132" fill="${color}" font-family="Plus Jakarta Sans, sans-serif" font-size="9" font-weight="800" letter-spacing="1.5" text-anchor="middle">
      OFFICIAL SEAL
    </text>
    <text x="120" y="145" fill="${color}" font-family="JetBrains Mono, monospace" font-size="7.5" font-weight="600" letter-spacing="1" text-anchor="middle">
      ${serialNumber}
    </text>
    <text x="120" y="157" fill="${color}" font-family="Plus Jakarta Sans, sans-serif" font-size="7" font-weight="600" letter-spacing="0.5" text-anchor="middle">
      VERIFIED & APPROVED
    </text>

    <!-- Star markers -->
    <text x="24" y="124" fill="${color}" font-size="10" text-anchor="middle">★</text>
    <text x="216" y="124" fill="${color}" font-size="10" text-anchor="middle">★</text>
  </g>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates realistic SVG transparent electronic signatures with natural fountain pen ink dynamics
 */
export function generateSampleSignatureSvg(
  name: string,
  variant: 1 | 2 | 3 = 1,
  color: string = '#0f244a'
): string {
  // Realistic natural handwritten stroke paths
  let pathD = '';
  if (variant === 1) {
    // Dr. Vance / fluid executive cursive
    pathD = 'M25,58 C35,28 42,15 48,15 C54,15 46,65 52,65 C62,65 75,35 88,38 C98,40 102,52 115,48 C128,44 145,28 158,32 C172,36 178,55 195,45 C208,38 218,22 230,28 C238,32 225,55 240,50 M35,52 Q120,68 250,48 M45,72 Q140,82 235,62';
  } else if (variant === 2) {
    // Prof. Wright / sharp academic signature
    pathD = 'M30,45 C38,18 48,12 55,25 C62,38 48,70 56,70 C68,70 82,32 95,42 C108,52 112,65 125,52 C138,39 152,22 165,30 C178,38 182,58 198,48 C212,38 225,25 242,32 M60,55 L230,52 M25,65 Q135,78 245,58';
  } else {
    // Registrar / Warden bold flourish
    pathD = 'M28,60 C32,25 45,18 52,22 C59,26 50,68 62,66 C75,64 88,40 102,44 C116,48 120,60 134,54 C148,48 160,32 174,38 C188,44 195,62 210,50 C222,40 234,30 248,36 M20,68 C90,75 160,78 250,56';
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90">
  <g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${pathD}" stroke-width="2.6" opacity="0.92" />
    <path d="${pathD}" stroke-width="1.8" opacity="0.65" transform="translate(0.5, 0.5)" />
    <!-- Fine ink pen trail -->
    <circle cx="248" cy="36" r="1.2" fill="${color}" />
  </g>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
