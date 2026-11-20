import { abancaCsv } from './abanca'
import { activoBankPdf } from './activobank'
import { pluxeeCsv } from './pluxee'
import type { ImportSource } from './types'

/** Every file format the app can import. New banks (B1b, B1c, D…) register here. */
export const IMPORT_SOURCES: ImportSource[] = [abancaCsv, pluxeeCsv, activoBankPdf]

export function getSource(id: unknown): ImportSource | null {
  return IMPORT_SOURCES.find((s) => s.id === id) ?? null
}
