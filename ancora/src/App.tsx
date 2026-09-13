import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home } from './components/Home'
import { CrisisHub } from './components/CrisisHub'
import { ExerciseFlow } from './components/ExerciseFlow'
import type { ExerciseId } from './data/exercises'

type Screen =
  | { name: 'home' }
  | { name: 'crisis' }
  | { name: 'exercise'; id: ExerciseId; from: 'home' | 'crisis' }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [intensity, setIntensity] = useState<number | null>(null)

  return (
    <>
      <div className="atmosphere" aria-hidden="true">
        <div className="atmosphere__orb atmosphere__orb--a" />
        <div className="atmosphere__orb atmosphere__orb--b" />
        <div className="atmosphere__orb atmosphere__orb--c" />
      </div>

      <div className="app-shell">
        <div className="app-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={
                screen.name === 'exercise'
                  ? `exercise-${screen.id}`
                  : screen.name
              }
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {screen.name === 'home' && (
                <Home
                  onCrisis={() => setScreen({ name: 'crisis' })}
                  onOpenExercise={(id) =>
                    setScreen({ name: 'exercise', id, from: 'home' })
                  }
                />
              )}

              {screen.name === 'crisis' && (
                <CrisisHub
                  intensity={intensity}
                  onSetIntensity={setIntensity}
                  onOpenExercise={(id) =>
                    setScreen({ name: 'exercise', id, from: 'crisis' })
                  }
                  onBack={() => setScreen({ name: 'home' })}
                />
              )}

              {screen.name === 'exercise' && (
                <ExerciseFlow
                  id={screen.id}
                  onBack={() =>
                    setScreen(
                      screen.from === 'crisis'
                        ? { name: 'crisis' }
                        : { name: 'home' },
                    )
                  }
                  onDone={() =>
                    setScreen(
                      screen.from === 'crisis'
                        ? { name: 'crisis' }
                        : { name: 'home' },
                    )
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
