import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { exercises } from '../data/exercises'
import type { Trigger } from '../data/triggers'
import { formatDateTime, type CrisisEntry } from '../lib/journal'
import { triggerLabels } from '../lib/report'

type JournalScreenProps = {
  entries: CrisisEntry[]
  triggers: Trigger[]
  onDelete: (id: string) => void
  onStartLog: () => void
}

export function JournalScreen({ entries, triggers, onDelete, onStartLog }: JournalScreenProps) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries],
  )

  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="screen-head__title">Meu diário</h1>
        <p className="screen-head__text">
          Cada registro é uma prova de que você atravessou. Também é o que alimenta o relatório da
          terapia.
        </p>
      </header>

      <button type="button" className="btn btn--primary" style={{ width: '100%' }} onClick={onStartLog}>
        Registrar um episódio
      </button>

      {sorted.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '1.25rem' }}>
          <p>
            Ainda não há registros. Depois de um exercício, o app pergunta como você está — ou
            registre manualmente aqui.
          </p>
        </div>
      ) : (
        <section className="section">
          <h2 className="section__title">
            Histórico <span className="count-pill">{sorted.length}</span>
          </h2>
          <div className="stack">
            <AnimatePresence initial={false}>
              {sorted.map((entry) => {
                const labels = triggerLabels(entry, triggers)
                const used = entry.exercisesUsed.map(
                  (id) => exercises.find((exercise) => exercise.id === id)?.title ?? id,
                )
                return (
                  <motion.article
                    key={entry.id}
                    className="entry-card"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    layout
                  >
                    <header className="entry-card__head">
                      <span className="entry-card__date">{formatDateTime(entry.createdAt)}</span>
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm"
                        aria-label="Apagar registro"
                        onClick={() => onDelete(entry.id)}
                      >
                        ✕
                      </button>
                    </header>

                    <p className="entry-card__intensity">
                      <strong>{entry.intensityBefore ?? '—'}</strong>
                      <span aria-hidden="true">→</span>
                      <strong>{entry.intensityAfter ?? '—'}</strong>
                      <span className="entry-card__intensity-label">intensidade</span>
                    </p>

                    {labels.length > 0 && (
                      <p className="entry-card__line">
                        <span>Gatilhos:</span> {labels.join(', ')}
                      </p>
                    )}
                    {entry.emotions.length > 0 && (
                      <p className="entry-card__line">
                        <span>Emoções:</span> {entry.emotions.join(', ')}
                      </p>
                    )}
                    {entry.impulses.length > 0 && (
                      <p className="entry-card__line">
                        <span>Impulsos:</span> {entry.impulses.join(', ')}
                        {entry.actedOnImpulse !== null &&
                          ` · ${entry.actedOnImpulse ? 'agiu' : 'conteve'}`}
                      </p>
                    )}
                    {used.length > 0 && (
                      <p className="entry-card__line">
                        <span>Habilidades:</span> {used.join(', ')}
                      </p>
                    )}
                    {entry.whatHelped.trim() && (
                      <p className="entry-card__note">“{entry.whatHelped.trim()}”</p>
                    )}
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  )
}
