import { exercises } from '../data/exercises'
import type { Trigger } from '../data/triggers'
import {
  entryWithinRange,
  formatDate,
  formatDateTime,
  type CrisisEntry,
  type ExportRange,
} from './journal'

export type ReportOptions = {
  patientName: string
  range: ExportRange
  includeNotes: boolean
}

export type ReportStats = {
  total: number
  averageBefore: number | null
  averageAfter: number | null
  averageDrop: number | null
  topTriggers: { label: string; count: number }[]
  topEmotions: { label: string; count: number }[]
  topImpulses: { label: string; count: number }[]
  topExercises: { label: string; count: number }[]
  impulseActedCount: number
  impulseResistedCount: number
}

function rank(values: string[], limit = 5) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function average(values: number[]) {
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
}

export function triggerLabels(entry: CrisisEntry, triggers: Trigger[]) {
  const mapped = entry.triggerIds
    .map((id) => triggers.find((trigger) => trigger.id === id)?.label)
    .filter((label): label is string => Boolean(label))
  return [...mapped, ...entry.customTriggers]
}

export function buildStats(entries: CrisisEntry[], triggers: Trigger[]): ReportStats {
  const before = entries
    .map((entry) => entry.intensityBefore)
    .filter((value): value is number => value !== null)
  const after = entries
    .map((entry) => entry.intensityAfter)
    .filter((value): value is number => value !== null)

  const drops = entries
    .filter((entry) => entry.intensityBefore !== null && entry.intensityAfter !== null)
    .map((entry) => (entry.intensityBefore as number) - (entry.intensityAfter as number))

  return {
    total: entries.length,
    averageBefore: average(before),
    averageAfter: average(after),
    averageDrop: average(drops),
    topTriggers: rank(entries.flatMap((entry) => triggerLabels(entry, triggers))),
    topEmotions: rank(entries.flatMap((entry) => entry.emotions)),
    topImpulses: rank(entries.flatMap((entry) => entry.impulses)),
    topExercises: rank(
      entries.flatMap((entry) =>
        entry.exercisesUsed.map(
          (id) => exercises.find((exercise) => exercise.id === id)?.title ?? id,
        ),
      ),
    ),
    impulseActedCount: entries.filter((entry) => entry.actedOnImpulse === true).length,
    impulseResistedCount: entries.filter((entry) => entry.actedOnImpulse === false).length,
  }
}

export function selectEntries(entries: CrisisEntry[], range: ExportRange) {
  return entries
    .filter((entry) => entryWithinRange(entry, range))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

const rangeLabels: Record<ExportRange, string> = {
  7: 'últimos 7 dias',
  30: 'últimos 30 dias',
  90: 'últimos 90 dias',
  0: 'histórico completo',
}

export function rangeLabel(range: ExportRange) {
  return rangeLabels[range]
}

export function buildReportText(
  entries: CrisisEntry[],
  triggers: Trigger[],
  options: ReportOptions,
) {
  const selected = selectEntries(entries, options.range)
  const stats = buildStats(selected, triggers)
  const lines: string[] = []

  lines.push('RELATÓRIO ÂNCORA')
  lines.push('Registro de crises e gatilhos')
  lines.push('='.repeat(40))
  if (options.patientName.trim()) {
    lines.push(`Paciente: ${options.patientName.trim()}`)
  }
  lines.push(`Período: ${rangeLabel(options.range)}`)
  lines.push(`Gerado em: ${formatDateTime(new Date().toISOString())}`)
  lines.push('')

  lines.push('RESUMO')
  lines.push('-'.repeat(40))
  lines.push(`Episódios registrados: ${stats.total}`)
  if (stats.averageBefore !== null) {
    lines.push(`Intensidade média no início: ${stats.averageBefore}/10`)
  }
  if (stats.averageAfter !== null) {
    lines.push(`Intensidade média ao final: ${stats.averageAfter}/10`)
  }
  if (stats.averageDrop !== null) {
    lines.push(`Redução média após os exercícios: ${stats.averageDrop} pontos`)
  }
  lines.push(
    `Impulsos: ${stats.impulseResistedCount} contidos · ${stats.impulseActedCount} executados`,
  )
  lines.push('')

  const section = (title: string, items: { label: string; count: number }[]) => {
    if (items.length === 0) return
    lines.push(title)
    lines.push('-'.repeat(40))
    for (const item of items) {
      lines.push(`• ${item.label} — ${item.count}x`)
    }
    lines.push('')
  }

  section('GATILHOS MAIS FREQUENTES', stats.topTriggers)
  section('EMOÇÕES MAIS FREQUENTES', stats.topEmotions)
  section('IMPULSOS MAIS FREQUENTES', stats.topImpulses)
  section('HABILIDADES MAIS USADAS', stats.topExercises)

  lines.push('EPISÓDIOS')
  lines.push('-'.repeat(40))
  if (selected.length === 0) {
    lines.push('Nenhum episódio registrado neste período.')
  }

  for (const entry of selected) {
    const labels = triggerLabels(entry, triggers)
    lines.push(`[${formatDateTime(entry.createdAt)}]`)
    lines.push(
      `  Intensidade: ${entry.intensityBefore ?? '—'} → ${entry.intensityAfter ?? '—'}`,
    )
    if (labels.length) lines.push(`  Gatilhos: ${labels.join(', ')}`)
    if (entry.emotions.length) lines.push(`  Emoções: ${entry.emotions.join(', ')}`)
    if (entry.impulses.length) lines.push(`  Impulsos: ${entry.impulses.join(', ')}`)
    if (entry.actedOnImpulse !== null) {
      lines.push(`  Agiu no impulso: ${entry.actedOnImpulse ? 'sim' : 'não'}`)
    }
    if (entry.exercisesUsed.length) {
      const used = entry.exercisesUsed.map(
        (id) => exercises.find((exercise) => exercise.id === id)?.title ?? id,
      )
      lines.push(`  Habilidades usadas: ${used.join(', ')}`)
    }
    if (options.includeNotes && entry.whatHelped.trim()) {
      lines.push(`  O que ajudou: ${entry.whatHelped.trim()}`)
    }
    if (options.includeNotes && entry.note.trim()) {
      lines.push(`  Observações: ${entry.note.trim()}`)
    }
    lines.push('')
  }

  lines.push('-'.repeat(40))
  lines.push(
    'Gerado pelo app Âncora. Material de apoio ao acompanhamento clínico; não substitui avaliação profissional.',
  )

  return lines.join('\n')
}

export function buildFileName(options: ReportOptions) {
  const name = options.patientName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const stamp = formatDate(new Date().toISOString()).replace(/\//g, '-')
  return `ancora-relatorio${name ? `-${name}` : ''}-${stamp}.txt`
}
