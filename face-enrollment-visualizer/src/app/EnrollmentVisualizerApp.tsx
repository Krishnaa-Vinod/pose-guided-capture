import { DebugPipelinePanel } from '../components/debug-panel/DebugPipelinePanel'
import { PhoneEnrollmentPanel } from '../components/phone-ui/PhoneEnrollmentPanel'
import { useAudioGuide } from '../hooks/useAudioGuide'
import { useRemoteEnrollmentSession } from '../hooks/useRemoteEnrollmentSession'

export const EnrollmentVisualizerApp = () => {
  const {
    videoRef,
    snapshot,
    isRunning,
    isStarting,
    error,
    start,
    restart,
  } = useRemoteEnrollmentSession()

  // Provide a minimal default snapshot for the initial render
  const defaultSnapshot = {
    state: 'idle',
    prompt: { text: 'Start when ready', reason: 'Waiting...' },
    progress: 0,
    coverageBins: [],
    gate: { accepted: false, decisionReason: 'idle' },
    quality: { overall: 0 }
  }

  const activeSnapshot: any = snapshot || defaultSnapshot
  const progressPct = Math.round((activeSnapshot.progress || 0) * 100)
  const audioGuide = useAudioGuide(activeSnapshot?.prompt?.text)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,rgba(255,140,0,0.15),transparent_46%),radial-gradient(circle_at_85%_8%,rgba(255,140,0,0.08),transparent_40%),linear-gradient(165deg,#0a0703,#1a0f05_42%,#0d0703_100%)] px-4 py-4 text-orange-100 md:px-8 md:py-6">
      <div className="mx-auto max-w-[1460px] space-y-5">
        <header className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-black/70 to-black/40 px-5 py-4 shadow-xl backdrop-blur-xl md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.85)]" />
              <p className="text-sm font-semibold tracking-wide text-orange-100">Enrollment Console</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
              <span className="rounded-full border border-orange-400/35 bg-orange-600/20 px-3 py-1.5 text-orange-200">
                State {activeSnapshot.state || 'idle'}
              </span>
              <span className="rounded-full border border-orange-400/35 bg-orange-600/20 px-3 py-1.5 text-orange-200">
                Progress {progressPct}%
              </span>
            </div>
          </div>
        </header>

        <main className="grid items-stretch gap-5 lg:grid-cols-[430px_minmax(0,1fr)] lg:h-[920px]">
          <div className="flex h-full flex-col items-stretch justify-center lg:justify-start">
            <PhoneEnrollmentPanel
              videoRef={videoRef}
              snapshot={activeSnapshot}
              isRunning={isRunning}
              isStarting={isStarting}
              error={error}
              audioGuideEnabled={audioGuide.enabled}
              isAudioGuideSupported={audioGuide.isSupported}
              isSpeaking={audioGuide.isSpeaking}
              onToggleAudioGuide={() => audioGuide.setEnabled(!audioGuide.enabled)}
              onStart={() => void start()}
              onRestart={() => void restart()}
            />
          </div>

          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <DebugPipelinePanel
              videoRef={videoRef}
              snapshot={activeSnapshot}
              isRunning={isRunning}
              audioGuideEnabled={audioGuide.enabled}
              isSpeaking={audioGuide.isSpeaking}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
