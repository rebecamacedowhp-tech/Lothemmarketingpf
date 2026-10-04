import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  acceptsIdeas,
  exercises,
  groundingPrompts,
  sootheSenses,
  stopSteps,
  tippSteps,
  type ExerciseId,
} from '../data/exercises'

type ExerciseFlowProps = {
  id: ExerciseId
  onBack: () => void
  onDone: () => void
}

export function ExerciseFlow({ id, onBack, onDone }: ExerciseFlowProps) {
  const meta = exercises.find((item) => item.id === id)

  return (
    <div>
      <header className="topbar">
        <button type="button" className="brand-mark" onClick={onBack} aria-label="Voltar">
          <span className="brand-mark__icon">←</span>
          <span className="brand-mark__name">{meta?.title ?? 'Exercício'}</span>
        </button>
      </header>

      {id === 'tipp' && <TippExercise onDone={onDone} />}
      {id === 'grounding' && <GroundingExercise onDone={onDone} />}
      {id === 'breathing' && <BreathingExercise onDone={onDone} />}
      {id === 'stop' && <StopExercise onDone={onDone} />}
      {id === 'soothe' && <SootheExercise onDone={onDone} />}
      {id === 'distract' && <DistractExercise onDone={onDone} />}
    </div>
  )
}

function Progress({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100
  return (
    <div className="progress-track" aria-hidden="true">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

function DonePanel({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      className="panel complete-state"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <h2>Você segurou a âncora.</h2>
      <p>
        A onda pode ainda existir — e tudo bem. Você deu um passo. Se precisar, repita ou escolha
        outro exercício.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={onDone}>
          Voltar às ferramentas
        </button>
      </div>
    </motion.div>
  )
}

function TippExercise({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const current = tippSteps[step]

  if (done) return <DonePanel onDone={onDone} />

  return (
    <div className="panel">
      <p className="panel__eyebrow">TIPP · passo {step + 1} de {tippSteps.length}</p>
      <Progress step={step} total={tippSteps.length} />
      <AnimatePresence mode="wait">
        <motion.div
          key={current.name}
          className="step-card"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.28 }}
        >
          <div className="step-card__letter">{current.letter}</div>
          <h3>{current.name}</h3>
          <p>{current.detail}</p>
        </motion.div>
      </AnimatePresence>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Anterior
        </button>
        {step < tippSteps.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => setStep((s) => s + 1)}>
            Fiz isso
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setDone(true)}>
            Concluir
          </button>
        )}
      </div>
    </div>
  )
}

function GroundingExercise({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [notes, setNotes] = useState<string[]>(() => groundingPrompts.map(() => ''))
  const [done, setDone] = useState(false)
  const current = groundingPrompts[step]

  if (done) return <DonePanel onDone={onDone} />

  return (
    <div className="panel">
      <p className="panel__eyebrow">Aterramento · {step + 1}/{groundingPrompts.length}</p>
      <Progress step={step} total={groundingPrompts.length} />
      <AnimatePresence mode="wait">
        <motion.div
          key={current.sense}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          <h2 className="panel__title">
            {current.count} · {current.sense}
          </h2>
          <p className="panel__text">{current.prompt}</p>
          <label className="sr-only" htmlFor="ground-note">
            Suas respostas
          </label>
          <textarea
            id="ground-note"
            value={notes[step]}
            onChange={(e) => {
              const next = [...notes]
              next[step] = e.target.value
              setNotes(next)
            }}
            placeholder="Escreva aqui se quiser… ou só observe em silêncio."
            rows={4}
            style={{
              width: '100%',
              marginTop: '1rem',
              borderRadius: '16px',
              border: '1px solid var(--line)',
              padding: '0.9rem 1rem',
              background: 'rgba(255,255,255,0.7)',
              resize: 'vertical',
              color: 'var(--ink)',
            }}
          />
        </motion.div>
      </AnimatePresence>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Anterior
        </button>
        {step < groundingPrompts.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => setStep((s) => s + 1)}>
            Próximo sentido
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setDone(true)}>
            Estou mais presente
          </button>
        )}
      </div>
    </div>
  )
}

type BreathPhase = 'inhale' | 'hold' | 'exhale'

const BREATH_DURATIONS: Record<BreathPhase, number> = {
  inhale: 4000,
  hold: 2000,
  exhale: 6000,
}

const BREATH_LABELS: Record<BreathPhase, string> = {
  inhale: 'Inspire',
  hold: 'Segure',
  exhale: 'Expire bem devagar',
}

function BreathingExercise({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<BreathPhase>('inhale')
  const [cycles, setCycles] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!running || done) return

    const timer = window.setTimeout(() => {
      if (phase === 'inhale') {
        setPhase('hold')
        return
      }
      if (phase === 'hold') {
        setPhase('exhale')
        return
      }

      const nextCycle = cycles + 1
      if (nextCycle >= 4) {
        setRunning(false)
        setDone(true)
        return
      }

      setCycles(nextCycle)
      setPhase('inhale')
    }, BREATH_DURATIONS[phase])

    return () => window.clearTimeout(timer)
  }, [running, phase, done, cycles])

  if (done) return <DonePanel onDone={onDone} />

  const scale = phase === 'inhale' ? 1.12 : phase === 'hold' ? 1.08 : 0.88

  return (
    <div className="panel">
      <p className="panel__eyebrow">Respiração ritmada</p>
      <h2 className="panel__title">Expire mais longo.</h2>
      <p className="panel__text">
        Quatro ciclos: inspire 4s, segure 2s, expire 6s. Acompanhe o círculo.
      </p>

      <div className="breath-stage">
        <motion.div
          className="breath-circle"
          animate={{ scale: running ? scale : 1 }}
          transition={{ duration: BREATH_DURATIONS[phase] / 1000, ease: 'easeInOut' }}
        >
          <strong>{running ? BREATH_LABELS[phase] : 'Pronto?'}</strong>
        </motion.div>
        <p className="breath-label">
          {running ? `Ciclo ${Math.min(cycles + 1, 4)} de 4` : 'Toque para começar'}
        </p>
        <p className="breath-hint">Se sentir tontura, volte à respiração natural.</p>
      </div>

      <div className="btn-row">
        {!running ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setCycles(0)
              setPhase('inhale')
              setRunning(true)
            }}
          >
            Começar respiração
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--soft"
            onClick={() => {
              setRunning(false)
              setDone(true)
            }}
          >
            Encerrar agora
          </button>
        )}
      </div>
    </div>
  )
}

function StopExercise({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const current = stopSteps[step]

  if (done) return <DonePanel onDone={onDone} />

  return (
    <div className="panel">
      <p className="panel__eyebrow">STOP · {step + 1}/{stopSteps.length}</p>
      <Progress step={step} total={stopSteps.length} />
      <AnimatePresence mode="wait">
        <motion.div
          key={current.title}
          className="step-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          <div className="step-card__letter">{current.letter}</div>
          <h3>{current.title}</h3>
          <p>{current.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Anterior
        </button>
        {step < stopSteps.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => setStep((s) => s + 1)}>
            Próximo
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setDone(true)}>
            Escolhi minha próxima ação
          </button>
        )}
      </div>
    </div>
  )
}

function SootheExercise({ onDone }: { onDone: () => void }) {
  const [doneSenses, setDoneSenses] = useState<string[]>([])
  const [finished, setFinished] = useState(false)

  if (finished) return <DonePanel onDone={onDone} />

  return (
    <div className="panel stack">
      <div>
        <p className="panel__eyebrow">Autocuidado sensorial</p>
        <h2 className="panel__title">Conforte o corpo.</h2>
        <p className="panel__text">
          Escolha um sentido e faça algo gentil. Marque o que experimentou — um já ajuda.
        </p>
      </div>

      {sootheSenses.map((item) => {
        const active = doneSenses.includes(item.sense)
        return (
          <div key={item.sense} className="step-card">
            <h3>{item.sense}</h3>
            <ul className="idea-list">
              {item.ideas.map((idea) => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
            <div className="chip-list">
              <button
                type="button"
                className={`sense-chip${active ? ' is-done' : ''}`}
                onClick={() =>
                  setDoneSenses((prev) =>
                    active ? prev.filter((s) => s !== item.sense) : [...prev, item.sense],
                  )
                }
              >
                {active ? 'Feito' : 'Experimentei'}
              </button>
            </div>
          </div>
        )
      })}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={doneSenses.length === 0}
          onClick={() => setFinished(true)}
        >
          Me tratei com cuidado
        </button>
      </div>
    </div>
  )
}

function DistractExercise({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const current = acceptsIdeas[index]

  if (done) return <DonePanel onDone={onDone} />

  return (
    <div className="panel">
      <p className="panel__eyebrow">
        ACCEPTS · {index + 1}/{acceptsIdeas.length}
      </p>
      <Progress step={index} total={acceptsIdeas.length} />
      <AnimatePresence mode="wait">
        <motion.div
          key={current.name}
          className="step-card"
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
        >
          <div className="step-card__letter">{current.letter}</div>
          <h3>{current.name}</h3>
          <ul className="idea-list">
            {current.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </motion.div>
      </AnimatePresence>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setIndex((i) => (i + 1) % acceptsIdeas.length)}
        >
          Outra ideia
        </button>
        <button type="button" className="btn btn--primary" onClick={() => setDone(true)}>
          Vou tentar isso
        </button>
      </div>
    </div>
  )
}
