import QRCode from "qrcode";

/** A QR code as a square grid of modules (true = dark), plus the quiet-zone margin to draw around it. */
export type QrMatrix = { size: number; dark: boolean[][] };

/** Encode `text` (error correction M: tolerates a smudged or creased receipt). Pure and deterministic. */
export function qrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const dark = Array.from({ length: modules.size }, (_, row) => Array.from({ length: modules.size }, (_, col) => Boolean(modules.get(row, col))));
  return { size: modules.size, dark };
}

/** One SVG path for every dark module, offset by the quiet zone (4 modules is the QR standard). */
export function qrPath({ size, dark }: QrMatrix, margin = 4): { viewBox: string; d: string } {
  let d = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) if (dark[row]![col]) d += `M${col + margin} ${row + margin}h1v1h-1z`;
  }
  const full = size + margin * 2;
  return { viewBox: `0 0 ${full} ${full}`, d };
}
