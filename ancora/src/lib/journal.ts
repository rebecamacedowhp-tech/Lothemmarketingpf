import type { ExerciseId } from '../data/exercises'

export type CrisisEntry = {
  id: string
  createdAt: string
  intensityBefore: number | null
  intensityAfter: number | null
  triggerIds: string[]
  customTriggers: string[]
  emotions: string[]
  impulses: string[]
  actedOnImpulse: boolean | null
  exercisesUsed: ExerciseId[]
  whatHelped: string
  note: string
}

export type ExportRange = 7 | 30 | 90 | 0

export function entryWithinRange(entry: CrisisEntry, days: ExportRange) {
  if (days === 0) return true
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(entry.createdAt).getTime() >= cutoff
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
