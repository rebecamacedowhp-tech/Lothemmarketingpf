import { motion } from 'framer-motion'
import { crisisHelpline, exercises, type ExerciseId } from '../data/exercises'

type CrisisHubProps = {
  intensity: number | null
  onSetIntensity: (value: number) => void
  onOpenExercise: (id: ExerciseId) => void
  onBack: () => void
}

export function CrisisHub({
  intensity,
  onSetIntensity,
  onOpenExercise,
  onBack,
}: CrisisHubProps) {
  const suggested =
    intensity !== null && intensity >= 8
      ? ['tipp', 'breathing', 'grounding']
      : intensity !== null && intensity >= 5
        ? ['breathing', 'grounding', 'stop']
        : ['soothe', 'distract', 'breathing']

  const recommended = exercises.filter((item) =>
    suggested.includes(item.id as (typeof suggested)[number]),
  )

  return (
    <div>
      <header className="topbar">
        <button type="button" className="brand-mark" onClick={onBack} aria-label="Voltar ao início">
          <span className="brand-mark__icon">
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
          </span>
          <span className="brand-mark__name">Âncora</span>
        </button>
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Fechar">
          ✕
        </button>
      </header>

      <motion.div
        className="panel crisis-hub-intro"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <p className="panel__eyebrow">Modo crise</p>
        <h1 className="panel__title">Você não precisa resolver tudo agora.</h1>
        <p className="panel__text">
          Vamos só baixar a intensidade. De 0 a 10, o quanto isso está te pegando neste instante?
        </p>

        <div className="scale-grid" role="group" aria-label="Intensidade emocional de 0 a 10">
          {Array.from({ length: 11 }, (_, value) => (
            <button
              key={value}
              type="button"
              className={`scale-btn${intensity === value ? ' is-active' : ''}`}
              onClick={() => onSetIntensity(value)}
              aria-pressed={intensity === value}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="scale-labels">
          <span>Calmo</span>
          <span>No limite</span>
        </div>
      </motion.div>

      <section className="section" aria-labelledby="suggest-title">
        <h2 id="suggest-title" className="section__title">
          Comece por aqui
        </h2>
        <p className="section__text">
          {intensity === null
            ? 'Toque em um número acima ou escolha qualquer ferramenta.'
            : intensity >= 8
              ? 'Intensidade alta: priorize mudar o corpo primeiro (TIPP e respiração).'
              : intensity >= 5
                ? 'Intensidade média: aterre-se e pause antes de agir.'
                : 'Intensidade mais baixa: cuide dos sentidos e distraia com gentileza.'}
        </p>

        <div className="exercise-grid">
          {recommended.map((exercise, index) => (
            <motion.button
              key={exercise.id}
              type="button"
              className="exercise-card"
              onClick={() => onOpenExercise(exercise.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
            >
              <span
                className="exercise-card__badge"
                style={{ background: exercise.accent }}
                aria-hidden="true"
              >
                {exercise.title.slice(0, 1)}
              </span>
              <span>
                <p className="exercise-card__title">{exercise.title}</p>
                <p className="exercise-card__meta">{exercise.subtitle}</p>
              </span>
              <span className="exercise-card__arrow" aria-hidden="true">
                →
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      <div className="help-banner" role="note">
        Se estiver em perigo agora: emergência local. Apoio emocional: {crisisHelpline.label}.{' '}
        {crisisHelpline.note}
      </div>
    </div>
  )
}
