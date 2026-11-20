/**
 * PDF text extraction for bank statements (pdfjs-dist, no network, no eval).
 * Returns positioned text items grouped into visual lines, page by page.
 */
export type TextItem = { str: string; x: number; y: number; width: number }
export type TextLine = { page: number; y: number; items: TextItem[] }

export async function pdfLines(bytes: Uint8Array): Promise<TextLine[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // pdfjs takes ownership of the buffer; give it a copy.
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise
  const lines: TextLine[] = []
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const tc = await page.getTextContent()
      const items: TextItem[] = []
      for (const it of tc.items as Array<{ str?: string; transform?: number[]; width?: number }>) {
        if (!it.str || !it.str.trim() || !it.transform) continue
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width ?? 0 })
      }
      // Top to bottom, then left to right; items within 2pt vertically share a line.
      items.sort((a, b) => b.y - a.y || a.x - b.x)
      const pageLines: TextLine[] = []
      for (const it of items) {
        const last = pageLines[pageLines.length - 1]
        if (last && Math.abs(last.y - it.y) <= 2) last.items.push(it)
        else pageLines.push({ page: p, y: it.y, items: [it] })
      }
      for (const l of pageLines) l.items.sort((a, b) => a.x - b.x)
      lines.push(...pageLines)
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return lines
}

/** Approximate right edge of a substring inside an item (fonts are close enough to proportional). */
export function rightEdgeOf(item: TextItem, endIndex: number): number {
  return item.x + (item.str.length ? (item.width * endIndex) / item.str.length : 0)
}
