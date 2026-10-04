import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  triggerCategories,
  triggerSuggestions,
  type Trigger,
  type TriggerCategory,
} from '../data/triggers'
import { createId } from '../lib/storage'
import type { CrisisEntry } from '../lib/journal'
import { triggerLabels } from '../lib/report'

type TriggersScreenProps = {
  triggers: Trigger[]
  entries: CrisisEntry[]
  onChange: (next: Trigger[]) => void
}

export function TriggersScreen({ triggers, entries, onChange }: TriggersScreenProps) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<TriggerCategory>('relacional')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<TriggerCategory | 'todos'>('todos')

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) {
      for (const labelText of triggerLabels(entry, triggers)) {
        map.set(labelText, (map.get(labelText) ?? 0) + 1)
      }
    }
    return map
  }, [entries, triggers])

  const visible = useMemo(
    () => (filter === 'todos' ? triggers : triggers.filter((t) => t.category === filter)),
    [filter, triggers],
  )

  const unusedSuggestions = useMemo(
    () =>
      triggerSuggestions.filter(
        (suggestion) =>
          !triggers.some(
            (trigger) => trigger.label.toLowerCase() === suggestion.label.toLowerCase(),
          ),
      ),
    [triggers],
  )

  function addTrigger(nextLabel: string, nextCategory: TriggerCategory, nextNote = '') {
    const clean = nextLabel.trim()
    if (!clean) return
    const exists = triggers.some((t) => t.label.toLowerCase() === clean.toLowerCase())
    if (exists) return
    onChange([
      {
        id: createId(),
        label: clean,
        category: nextCategory,
        note: nextNote.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
      ...triggers,
    ])
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="screen-head__title">Meus gatilhos</h1>
        <p className="screen-head__text">
          Mapear o que dispara a crise ajuda a antecipar e a mostrar padrões para sua terapeuta.
        </p>
      </header>

      <section className="panel stack">
        <div>
          <p className="panel__eyebrow">Adicionar gatilho</p>
          <label className="field">
            <span className="field__label">O que costuma disparar a crise?</span>
            <input
              className="field__input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex.: quando não respondem minhas mensagens"
            />
          </label>

          <span className="field__label" style={{ display: 'block', marginBottom: '0.45rem' }}>
            Categoria
          </span>
          <div className="chip-list">
            {triggerCategories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sense-chip${category === item.id ? ' is-done' : ''}`}
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="field__hint">
            {triggerCategories.find((item) => item.id === category)?.hint}
          </p>

          <label className="field">
            <span className="field__label">Observação (opcional)</span>
            <textarea
              className="field__input"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Contexto, horário, com quem acontece…"
            />
          </label>

          <button
            type="button"
            className="btn btn--primary"
            style={{ width: '100%' }}
            disabled={!label.trim()}
            onClick={() => {
              addTrigger(label, category, note)
              setLabel('')
              setNote('')
            }}
          >
            Adicionar gatilho
          </button>
        </div>
      </section>

      {unusedSuggestions.length > 0 && (
        <section className="section">
          <h2 className="section__title">Sugestões comuns</h2>
          <p className="section__text">Toque para adicionar rapidamente.</p>
          <div className="chip-list">
            {unusedSuggestions.slice(0, 10).map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                className="sense-chip"
                onClick={() => addTrigger(suggestion.label, suggestion.category)}
              >
                + {suggestion.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section__title">
          Sua lista {triggers.length > 0 && <span className="count-pill">{triggers.length}</span>}
        </h2>

        {triggers.length > 0 && (
          <div className="chip-list" style={{ marginBottom: '0.85rem' }}>
            <button
              type="button"
              className={`sense-chip${filter === 'todos' ? ' is-done' : ''}`}
              onClick={() => setFilter('todos')}
            >
              Todos
            </button>
            {triggerCategories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sense-chip${filter === item.id ? ' is-done' : ''}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="empty-state">
            <p>
              {triggers.length === 0
                ? 'Nenhum gatilho mapeado ainda. Comece pelas sugestões acima.'
                : 'Nenhum gatilho nesta categoria.'}
            </p>
          </div>
        ) : (
          <div className="stack">
            <AnimatePresence initial={false}>
              {visible.map((trigger) => {
                const meta = triggerCategories.find((item) => item.id === trigger.category)
                const used = counts.get(trigger.label) ?? 0
                return (
                  <motion.article
                    key={trigger.id}
                    className="list-row"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    layout
                  >
                    <span
                      className="list-row__dot"
                      style={{ background: meta?.color ?? '#2f8f7b' }}
                      aria-hidden="true"
                    />
                    <div className="list-row__body">
                      <p className="list-row__title">{trigger.label}</p>
                      <p className="list-row__meta">
                        {meta?.label}
                        {used > 0 && ` · apareceu em ${used} ${used === 1 ? 'crise' : 'crises'}`}
                      </p>
                      {trigger.note && <p className="list-row__note">{trigger.note}</p>}
                    </div>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      aria-label={`Remover gatilho ${trigger.label}`}
                      onClick={() => onChange(triggers.filter((item) => item.id !== trigger.id))}
                    >
                      ✕
                    </button>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  )
}
