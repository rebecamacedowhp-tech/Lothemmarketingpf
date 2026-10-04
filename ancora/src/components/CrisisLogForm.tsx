import { useState } from 'react'
import { motion } from 'framer-motion'
import { emotionOptions, impulseOptions, type Trigger } from '../data/triggers'
import type { ExerciseId } from '../data/exercises'
import { createId } from '../lib/storage'
import type { CrisisEntry } from '../lib/journal'

type CrisisLogFormProps = {
  triggers: Trigger[]
  intensityBefore: number | null
  exercisesUsed: ExerciseId[]
  onSave: (entry: CrisisEntry) => void
  onSkip: () => void
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function CrisisLogForm({
  triggers,
  intensityBefore,
  exercisesUsed,
  onSave,
  onSkip,
}: CrisisLogFormProps) {
  const [intensityAfter, setIntensityAfter] = useState<number | null>(null)
  const [triggerIds, setTriggerIds] = useState<string[]>([])
  const [customTrigger, setCustomTrigger] = useState('')
  const [emotions, setEmotions] = useState<string[]>([])
  const [impulses, setImpulses] = useState<string[]>([])
  const [actedOnImpulse, setActedOnImpulse] = useState<boolean | null>(null)
  const [whatHelped, setWhatHelped] = useState('')
  const [note, setNote] = useState('')

  function save() {
    onSave({
      id: createId(),
      createdAt: new Date().toISOString(),
      intensityBefore,
      intensityAfter,
      triggerIds,
      customTriggers: customTrigger.trim() ? [customTrigger.trim()] : [],
      emotions,
      impulses,
      actedOnImpulse,
      exercisesUsed,
      whatHelped,
      note,
    })
  }

  return (
    <motion.div
      className="panel stack"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div>
        <p className="panel__eyebrow">Registro da crise</p>
        <h2 className="panel__title">Como você está agora?</h2>
        <p className="panel__text">
          Leva menos de um minuto. Isso vira o relatório que você leva para a terapia.
        </p>
      </div>

      <div>
        <span className="field__label">Intensidade agora (0–10)</span>
        <div className="scale-grid" role="group" aria-label="Intensidade após os exercícios">
          {Array.from({ length: 11 }, (_, value) => (
            <button
              key={value}
              type="button"
              className={`scale-btn${intensityAfter === value ? ' is-active' : ''}`}
              onClick={() => setIntensityAfter(value)}
              aria-pressed={intensityAfter === value}
            >
              {value}
            </button>
          ))}
        </div>
        {intensityBefore !== null && (
          <p className="field__hint">Você começou em {intensityBefore}/10.</p>
        )}
      </div>

      <div>
        <span className="field__label">O que disparou?</span>
        {triggers.length > 0 ? (
          <div className="chip-list">
            {triggers.map((trigger) => (
              <button
                key={trigger.id}
                type="button"
                className={`sense-chip${triggerIds.includes(trigger.id) ? ' is-done' : ''}`}
                onClick={() => setTriggerIds((prev) => toggle(prev, trigger.id))}
                aria-pressed={triggerIds.includes(trigger.id)}
              >
                {trigger.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="field__hint">
            Você ainda não mapeou gatilhos. Descreva abaixo — depois pode salvá-los na aba Gatilhos.
          </p>
        )}
        <label className="field">
          <span className="field__label">Outro gatilho</span>
          <input
            className="field__input"
            value={customTrigger}
            onChange={(event) => setCustomTrigger(event.target.value)}
            placeholder="Descreva em poucas palavras"
          />
        </label>
      </div>

      <div>
        <span className="field__label">Emoções</span>
        <div className="chip-list">
          {emotionOptions.map((emotion) => (
            <button
              key={emotion}
              type="button"
              className={`sense-chip${emotions.includes(emotion) ? ' is-done' : ''}`}
              onClick={() => setEmotions((prev) => toggle(prev, emotion))}
              aria-pressed={emotions.includes(emotion)}
            >
              {emotion}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="field__label">Impulsos que apareceram</span>
        <div className="chip-list">
          {impulseOptions.map((impulse) => (
            <button
              key={impulse}
              type="button"
              className={`sense-chip${impulses.includes(impulse) ? ' is-done' : ''}`}
              onClick={() => setImpulses((prev) => toggle(prev, impulse))}
              aria-pressed={impulses.includes(impulse)}
            >
              {impulse}
            </button>
          ))}
        </div>
        <div className="chip-list" style={{ marginTop: '0.6rem' }}>
          <button
            type="button"
            className={`sense-chip${actedOnImpulse === false ? ' is-done' : ''}`}
            onClick={() => setActedOnImpulse(actedOnImpulse === false ? null : false)}
            aria-pressed={actedOnImpulse === false}
          >
            Segurei o impulso
          </button>
          <button
            type="button"
            className={`sense-chip${actedOnImpulse === true ? ' is-done' : ''}`}
            onClick={() => setActedOnImpulse(actedOnImpulse === true ? null : true)}
            aria-pressed={actedOnImpulse === true}
          >
            Agi no impulso
          </button>
        </div>
      </div>

      <label className="field">
        <span className="field__label">O que ajudou?</span>
        <textarea
          className="field__input"
          rows={2}
          value={whatHelped}
          onChange={(event) => setWhatHelped(event.target.value)}
          placeholder="Ex.: gelo na nuca + respiração"
        />
      </label>

      <label className="field">
        <span className="field__label">Quero contar para minha terapeuta</span>
        <textarea
          className="field__input"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Escreva livremente. Isso entra no relatório de exportação."
        />
      </label>

      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={onSkip}>
          Agora não
        </button>
        <button type="button" className="btn btn--primary" onClick={save}>
          Salvar registro
        </button>
      </div>
    </motion.div>
  )
}
