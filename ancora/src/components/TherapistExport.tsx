import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Trigger } from '../data/triggers'
import type { CrisisEntry, ExportRange } from '../lib/journal'
import {
  buildFileName,
  buildReportText,
  buildStats,
  rangeLabel,
  selectEntries,
} from '../lib/report'
import { usePersistentState } from '../lib/storage'

type TherapistExportProps = {
  entries: CrisisEntry[]
  triggers: Trigger[]
}

const ranges: ExportRange[] = [7, 30, 90, 0]

export function TherapistExport({ entries, triggers }: TherapistExportProps) {
  const [patientName, setPatientName] = usePersistentState('patient-name', '')
  const [therapistEmail, setTherapistEmail] = usePersistentState('therapist-email', '')
  const [range, setRange] = useState<ExportRange>(30)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [feedback, setFeedback] = useState('')

  const report = useMemo(
    () => buildReportText(entries, triggers, { patientName, range, includeNotes }),
    [entries, triggers, patientName, range, includeNotes],
  )

  const selected = useMemo(() => selectEntries(entries, range), [entries, range])
  const stats = useMemo(() => buildStats(selected, triggers), [selected, triggers])

  function flash(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(''), 2600)
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report)
      flash('Relatório copiado.')
    } catch {
      flash('Não foi possível copiar. Use “Baixar arquivo”.')
    }
  }

  function downloadReport() {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildFileName({ patientName, range, includeNotes })
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    flash('Arquivo gerado.')
  }

  function emailReport() {
    const subject = encodeURIComponent(
      `Relatório Âncora${patientName.trim() ? ` — ${patientName.trim()}` : ''}`,
    )
    const body = encodeURIComponent(report.slice(0, 1800))
    window.location.href = `mailto:${therapistEmail.trim()}?subject=${subject}&body=${body}`
  }

  async function shareReport() {
    if (!navigator.share) {
      await copyReport()
      return
    }
    try {
      await navigator.share({ title: 'Relatório Âncora', text: report })
    } catch {
      // Compartilhamento cancelado pelo usuário.
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="screen-head__title">Levar para a terapia</h1>
        <p className="screen-head__text">
          Um resumo pronto dos seus episódios, gatilhos e habilidades usadas — do seu jeito, sem
          precisar lembrar de tudo na sessão.
        </p>
      </header>

      <section className="panel stack">
        <label className="field">
          <span className="field__label">Seu nome (aparece no relatório)</span>
          <input
            className="field__input"
            value={patientName}
            onChange={(event) => setPatientName(event.target.value)}
            placeholder="Opcional"
          />
        </label>

        <div>
          <span className="field__label">Período</span>
          <div className="chip-list">
            {ranges.map((option) => (
              <button
                key={option}
                type="button"
                className={`sense-chip${range === option ? ' is-done' : ''}`}
                onClick={() => setRange(option)}
                aria-pressed={range === option}
              >
                {rangeLabel(option)}
              </button>
            ))}
          </div>
        </div>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(event) => setIncludeNotes(event.target.checked)}
          />
          <span>Incluir meus textos pessoais (o que ajudou e observações)</span>
        </label>
      </section>

      <section className="section">
        <h2 className="section__title">Resumo do período</h2>
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">episódios</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{stats.averageBefore ?? '—'}</span>
            <span className="stat-card__label">intensidade inicial média</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{stats.averageAfter ?? '—'}</span>
            <span className="stat-card__label">intensidade final média</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{stats.impulseResistedCount}</span>
            <span className="stat-card__label">impulsos contidos</span>
          </div>
        </div>

        {stats.topTriggers.length > 0 && (
          <div className="panel" style={{ marginTop: '0.85rem' }}>
            <p className="panel__eyebrow">Gatilhos mais frequentes</p>
            <ul className="idea-list">
              {stats.topTriggers.map((item) => (
                <li key={item.label}>
                  {item.label} — {item.count}x
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section__title">Pré-visualização</h2>
        <motion.pre
          className="report-preview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          aria-label="Pré-visualização do relatório"
        >
          {report}
        </motion.pre>

        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={copyReport}>
            Copiar relatório
          </button>
          <button type="button" className="btn btn--soft" onClick={downloadReport}>
            Baixar arquivo
          </button>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn--soft" onClick={shareReport}>
            Compartilhar
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>

        <label className="field" style={{ marginTop: '1rem' }}>
          <span className="field__label">E-mail da terapeuta</span>
          <input
            className="field__input"
            type="email"
            value={therapistEmail}
            onChange={(event) => setTherapistEmail(event.target.value)}
            placeholder="terapeuta@exemplo.com"
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          style={{ width: '100%' }}
          disabled={!therapistEmail.trim()}
          onClick={emailReport}
        >
          Enviar por e-mail
        </button>

        {feedback && (
          <motion.p className="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {feedback}
          </motion.p>
        )}
      </section>

      <div className="disclaimer">
        <strong>Privacidade:</strong> tudo fica salvo apenas neste aparelho. Nada é enviado para
        servidores — você decide quando e para quem compartilhar.
      </div>
    </div>
  )
}
