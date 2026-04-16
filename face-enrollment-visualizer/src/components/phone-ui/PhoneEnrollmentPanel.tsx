import { CheckCircle2, FolderKanban, Loader2, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { ProgressRing } from './ProgressRing'

interface PhoneEnrollmentPanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  snapshot: any
  isRunning: boolean
  isStarting: boolean
  error: string | null
  audioGuideEnabled: boolean
  isAudioGuideSupported: boolean
  isSpeaking: boolean
  onToggleAudioGuide: () => void
  onStart: () => void
  onRestart: () => void
}

const stateLabel: Record<string, string> = {
  idle: 'Idle',
  waiting_for_face: 'Waiting for face',
  positioning: 'Positioning',
  tracking: 'Tracking',
  eligible_but_unstable: 'Eligible but unstable',
  accepting_coverage: 'Accepting coverage',
  completed: 'Completed',
  error: 'Error',
}

export const PhoneEnrollmentPanel = ({
  videoRef,
  snapshot,
  isRunning,
  isStarting,
  error,
  audioGuideEnabled,
  isAudioGuideSupported,
  isSpeaking,
  onToggleAudioGuide,
  onStart,
  onRestart,
}: PhoneEnrollmentPanelProps) => {
  const progressPct = Math.round((snapshot?.progress || 0) * 100)
  const targetBinLabel = (snapshot?.targetBin || 'center_center').replace('_', ' ').toUpperCase()
  const coverageBins = snapshot?.coverageBins || []
  const showStart = !isRunning && !snapshot?.completed && !isStarting
  const showRestart = !isRunning && snapshot?.completed

  const yawOrder = ['left', 'center', 'right']
  const pitchOrder = ['up', 'center', 'down']

  const getBin = (key: string) => coverageBins.find((bin: any) => bin.key === key)

  return (
    <section className="relative flex flex-col h-full overflow-hidden rounded-3xl border border-orange-500/30 bg-gradient-to-br from-black/80 to-black/55 p-4 shadow-2xl backdrop-blur-xl md:p-5">
      <div className="scene-glow-orange absolute -left-8 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full" />
      <div className="scene-glow-orange absolute -right-4 top-3 h-32 w-32 rounded-full" />

      <header className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] font-semibold text-orange-200/80">
        <span>Mobile Capture</span>
        <span className="rounded-full border border-orange-400/35 bg-orange-600/30 px-3 py-1 text-orange-200">
          {stateLabel[snapshot?.state] || snapshot?.state || 'Idle'}
        </span>
      </header>

      <div className="phone-enrollment-panel mx-auto w-full max-w-[430px] lg:mx-0 lg:max-w-none">
        <div className="rounded-[34px] border border-orange-400/35 bg-black/75 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
          <div className="overflow-hidden rounded-[28px] border border-orange-400/30 bg-black/90">
            <div className="relative aspect-[9/13] overflow-hidden bg-black">
              <div className="phone-notch absolute left-1/2 top-0 z-30 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-black/95" />

              <div className="absolute left-4 top-4 z-30 rounded-lg border border-orange-300/40 bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-orange-100">
                {stateLabel[snapshot?.state] || 'Idle'}
              </div>

              {snapshot?.prompt && (
                <div className="absolute right-4 top-4 z-30 max-w-[170px] rounded-xl border border-orange-300/50 bg-orange-950/90 px-3 py-2 text-right text-xs text-orange-100 shadow-lg backdrop-blur-md">
                  <div className="font-medium text-[13px] leading-tight">{snapshot.prompt.text}</div>
                  <div className="mt-1 text-[10px] text-orange-100/70">{snapshot.prompt.reason}</div>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full scale-x-[-1] object-cover"
              />

              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <ProgressRing progress={snapshot?.progress || 0} />
                <div className="absolute h-[176px] w-[176px] rounded-full border border-orange-400/40" />
                <div className="absolute bottom-6 rounded-full border border-orange-300/50 bg-black/65 px-3 py-1 text-[11px] font-mono text-orange-100">
                  {progressPct}%
                </div>
              </div>

              <div className="absolute bottom-4 left-4 z-30 rounded-lg border border-orange-400/45 bg-black/65 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-orange-100">
                Target {targetBinLabel}
              </div>

              {snapshot?.completed && (
                <div className="absolute inset-0 z-40 grid place-items-center bg-gradient-to-b from-black/55 to-black/85 p-8 text-center text-white backdrop-blur-sm">
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="rounded-full border border-orange-500/50 bg-orange-600/40 p-3">
                        <CheckCircle2 className="h-8 w-8 text-orange-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-orange-100">Enrollment complete</h3>
                    <p className="text-xs text-orange-100/70">{snapshot?.sessionLabel || 'Session'} saved curated views.</p>
                  </div>
                </div>
              )}

              {showStart && (
                <div className="absolute inset-0 z-40 grid place-items-center bg-gradient-to-b from-black/50 to-black/75 p-8 text-center text-white backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={onStart}
                    className="inline-flex items-center gap-2 rounded-full border border-orange-400/60 bg-gradient-to-r from-orange-600/55 to-orange-500/40 px-6 py-3 text-sm font-bold text-orange-50 shadow-lg hover:from-orange-500/60 hover:to-orange-400/50"
                  >
                    <Play className="h-4 w-4" />
                    Start enrollment
                  </button>
                </div>
              )}

              {isStarting && (
                <div className="absolute inset-0 z-40 grid place-items-center bg-gradient-to-b from-black/50 to-black/75 text-orange-100 backdrop-blur-sm">
                  <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-600/30 px-5 py-2.5 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Initializing model
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-orange-400/20 bg-gradient-to-b from-black/80 to-black/95 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-orange-400/25 bg-orange-600/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-orange-300/80">Progress</p>
                  <p className="mt-1 font-mono text-lg font-bold text-orange-100">{progressPct}%</p>
                </div>
                <div className="rounded-lg border border-orange-400/25 bg-orange-600/20 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-orange-300/80">Session</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-mono text-orange-100">
                    <FolderKanban className="h-3.5 w-3.5 text-orange-300" />
                    {snapshot?.sessionLabel || 'session'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleAudioGuide}
                disabled={!isAudioGuideSupported}
                className="flex w-full items-center justify-between rounded-xl border border-orange-400/35 bg-gradient-to-r from-orange-950/65 to-black/55 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="rounded-full border border-orange-400/40 bg-orange-600/20 p-1.5 text-orange-300">
                    {audioGuideEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-200">Audio Guide</p>
                    <p className="text-[10px] text-orange-100/70">
                      {!isAudioGuideSupported
                        ? 'Speech unavailable'
                        : audioGuideEnabled
                          ? (isSpeaking ? 'Speaking now' : 'Ready')
                          : 'Muted'}
                    </p>
                  </div>
                </div>

                <div className={audioGuideEnabled ? 'h-5 w-9 rounded-full bg-orange-500 p-1' : 'h-5 w-9 rounded-full bg-white/10 p-1'}>
                  <div className={audioGuideEnabled ? 'h-3 w-3 translate-x-4 rounded-full bg-white transition-transform duration-200' : 'h-3 w-3 translate-x-0 rounded-full bg-white transition-transform duration-200'} />
                </div>
              </button>

              <div className="rounded-xl border border-orange-400/25 bg-black/45 px-3 py-2">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-orange-300/80">Coverage Grid</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {pitchOrder.map((pitch) => (
                    yawOrder.map((yaw) => {
                      const key = `${yaw}_${pitch}`
                      const filled = Boolean(getBin(key)?.filled)
                      return (
                        <div
                          key={key}
                          className={filled ? 'rounded border border-orange-400/50 bg-orange-600/35 px-1 py-1 text-center text-[9px] font-bold uppercase text-orange-50' : 'rounded border border-orange-300/20 bg-black/45 px-1 py-1 text-center text-[9px] font-bold uppercase text-orange-200/55'}
                        >
                          {yaw[0]}{pitch[0]}
                        </div>
                      )
                    })
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRestart && (
        <button
          type="button"
          onClick={onRestart}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-400/40 bg-gradient-to-r from-orange-600/40 to-orange-500/30 px-4 py-2.5 text-sm font-bold text-orange-100 shadow-md transition duration-200 hover:from-orange-500/50 hover:to-orange-400/40 hover:shadow-lg hover:shadow-orange-500/20 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          Start new session
        </button>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-gradient-to-r from-red-600/20 to-red-500/10 px-4 py-3 text-sm text-red-100 shadow-md">
          {error}
        </div>
      )}
    </section>
  )
}
