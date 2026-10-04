import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home } from './components/Home'
import { CrisisHub } from './components/CrisisHub'
import { ExerciseFlow } from './components/ExerciseFlow'
import { TriggersScreen } from './components/TriggersScreen'
import { JournalScreen } from './components/JournalScreen'
import { TherapistExport } from './components/TherapistExport'
import { CrisisLogForm } from './components/CrisisLogForm'
import { TabBar, type TabId } from './components/TabBar'
import type { ExerciseId } from './data/exercises'
import type { Trigger } from './data/triggers'
import type { CrisisEntry } from './lib/journal'
import { usePersistentState } from './lib/storage'

type Screen =
  | { name: 'tabs' }
  | { name: 'crisis' }
  | { name: 'exercise'; id: ExerciseId; from: 'home' | 'crisis' }
  | { name: 'log' }

export default function App() {
  const [tab, setTab] = useState<TabId>('inicio')
  const [screen, setScreen] = useState<Screen>({ name: 'tabs' })
  const [intensity, setIntensity] = useState<number | null>(null)
  const [sessionExercises, setSessionExercises] = useState<ExerciseId[]>([])

  const [triggers, setTriggers] = usePersistentState<Trigger[]>('triggers', [])
  const [entries, setEntries] = usePersistentState<CrisisEntry[]>('entries', [])

  function openExercise(id: ExerciseId, from: 'home' | 'crisis') {
    setScreen({ name: 'exercise', id, from })
  }

  function finishExercise(id: ExerciseId) {
    setSessionExercises((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setScreen({ name: 'log' })
  }

  function closeLog() {
    setScreen({ name: 'tabs' })
    setIntensity(null)
    setSessionExercises([])
  }

  const screenKey =
    screen.name === 'exercise' ? `exercise-${screen.id}` : screen.name === 'tabs' ? `tab-${tab}` : screen.name

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
              key={screenKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {screen.name === 'tabs' && tab === 'inicio' && (
                <Home
                  entryCount={entries.length}
                  triggerCount={triggers.length}
                  onCrisis={() => setScreen({ name: 'crisis' })}
                  onOpenExercise={(id) => openExercise(id, 'home')}
                  onOpenTab={setTab}
                />
              )}

              {screen.name === 'tabs' && tab === 'gatilhos' && (
                <TriggersScreen triggers={triggers} entries={entries} onChange={setTriggers} />
              )}

              {screen.name === 'tabs' && tab === 'diario' && (
                <JournalScreen
                  entries={entries}
                  triggers={triggers}
                  onDelete={(id) => setEntries((prev) => prev.filter((entry) => entry.id !== id))}
                  onStartLog={() => setScreen({ name: 'log' })}
                />
              )}

              {screen.name === 'tabs' && tab === 'terapia' && (
                <TherapistExport entries={entries} triggers={triggers} />
              )}

              {screen.name === 'crisis' && (
                <CrisisHub
                  intensity={intensity}
                  onSetIntensity={setIntensity}
                  onOpenExercise={(id) => openExercise(id, 'crisis')}
                  onBack={() => setScreen({ name: 'tabs' })}
                />
              )}

              {screen.name === 'exercise' && (
                <ExerciseFlow
                  id={screen.id}
                  onBack={() =>
                    setScreen(screen.from === 'crisis' ? { name: 'crisis' } : { name: 'tabs' })
                  }
                  onDone={() => finishExercise(screen.id)}
                />
              )}

              {screen.name === 'log' && (
                <div className="screen">
                  <CrisisLogForm
                    triggers={triggers}
                    intensityBefore={intensity}
                    exercisesUsed={sessionExercises}
                    onSave={(entry) => {
                      setEntries((prev) => [entry, ...prev])
                      setTab('diario')
                      closeLog()
                    }}
                    onSkip={closeLog}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {screen.name === 'tabs' && <TabBar active={tab} onChange={setTab} />}
    </>
  )
}
