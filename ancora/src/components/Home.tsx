import { motion } from 'framer-motion'
import { exercises, type ExerciseId } from '../data/exercises'

type HomeProps = {
  onCrisis: () => void
  onOpenExercise: (id: ExerciseId) => void
}

const initials: Record<ExerciseId, string> = {
  tipp: 'T',
  grounding: '5',
  breathing: 'R',
  stop: 'S',
  soothe: 'A',
  distract: 'D',
}

export function Home({ onCrisis, onOpenExercise }: HomeProps) {
  return (
    <div>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand-mark__icon">
            <AnchorIcon />
          </span>
          <span className="brand-mark__name">Âncora</span>
        </div>
      </header>

      <section className="hero">
        <motion.h1
          className="hero__brand"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          Âncora
        </motion.h1>
        <motion.p
          className="hero__lead"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          Exercícios simples para se regular quando a onda emocional sobe demais.
        </motion.p>
        <motion.button
          type="button"
          className="crisis-cta"
          onClick={onCrisis}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          whileTap={{ scale: 0.98 }}
        >
          <span>Estou em crise — me ajude agora</span>
        </motion.button>
      </section>

      <section className="section" aria-labelledby="tools-title">
        <h2 id="tools-title" className="section__title">
          Ferramentas
        </h2>
        <p className="section__text">
          Escolha o que cabe neste momento. Tudo é curto, guiado e feito para a crise.
        </p>
        <div className="exercise-grid">
          {exercises.map((exercise, index) => (
            <motion.button
              key={exercise.id}
              type="button"
              className="exercise-card"
              onClick={() => onOpenExercise(exercise.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * index }}
            >
              <span
                className="exercise-card__badge"
                style={{ background: exercise.accent }}
                aria-hidden="true"
              >
                {initials[exercise.id]}
              </span>
              <span>
                <p className="exercise-card__title">{exercise.title}</p>
                <p className="exercise-card__meta">
                  {exercise.duration} · {exercise.when}
                </p>
              </span>
              <span className="exercise-card__arrow" aria-hidden="true">
                →
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      <aside className="disclaimer">
        <strong>Importante:</strong> Âncora é um apoio de autorregulação, não substitui terapia,
        medicação ou atendimento de emergência. Se houver risco à vida, procure ajuda imediata —
        no Brasil, CVV 188.
      </aside>
    </div>
  )
}

function AnchorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v14M12 17l-6 4M12 17l6 4M6 11h12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="4.5" r="1.8" fill="currentColor" />
    </svg>
  )
}
