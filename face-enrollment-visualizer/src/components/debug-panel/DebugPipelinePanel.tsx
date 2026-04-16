import React from 'react'
import clsx from 'clsx'

import { DebugVideoOverlay } from '../overlays/DebugVideoOverlay'

type YawBin = 'left' | 'center' | 'right'
type PitchBin = 'up' | 'center' | 'down'

interface DebugPipelinePanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  snapshot: any
  isRunning: boolean
  audioGuideEnabled: boolean
  isSpeaking: boolean
}

const yawOrder: YawBin[] = ['left', 'center', 'right']
const pitchOrder: PitchBin[] = ['up', 'center', 'down']

const formatScore = (value: number): string => `${Math.round(value * 100)}%`
const formatPose = (value: number): string => `${value.toFixed(1)}deg`

const stateTheme: Record<string, string> = {
  idle: 'bg-orange-600/30 text-orange-100 border border-orange-400/40',
  waiting_for_face: 'bg-orange-600/40 text-orange-100 border border-orange-400/50',
  positioning: 'bg-orange-600/40 text-orange-100 border border-orange-400/50',
  tracking: 'bg-orange-600/50 text-orange-100 border border-orange-400/60',
  eligible_but_unstable: 'bg-orange-600/35 text-orange-100 border border-orange-400/40',
  accepting_coverage: 'bg-orange-600/50 text-orange-100 border border-orange-400/60',
  completed: 'bg-orange-600/60 text-orange-50 border border-orange-400/70 font-bold',
  error: 'bg-red-600/40 text-red-100 border border-red-400/50',
}

export const DebugPipelinePanel = ({
  videoRef,
  snapshot,
  isRunning,
  audioGuideEnabled,
  isSpeaking,
}: DebugPipelinePanelProps) => {
  const quality = snapshot?.quality || { face_present: 0, face_centered: 0, face_scale: 0, brightness: 0, contrast: 0, stability: 0 }
  const targetBin: string = snapshot?.targetBin || 'center_center'
  const isUpPitch = targetBin.endsWith('_up')
  const isSideYaw = targetBin.startsWith('left_') || targetBin.startsWith('right_')

  const centeredThreshold = isSideYaw && isUpPitch ? 0.33 : isSideYaw ? 0.40 : isUpPitch ? 0.42 : 0.50
  const scaleThreshold = isSideYaw && isUpPitch ? 0.30 : isSideYaw || isUpPitch ? 0.34 : 0.40
  const stabilityThreshold = isSideYaw && isUpPitch ? 0.30 : isSideYaw || isUpPitch ? 0.36 : 0.48
  const sharpnessThreshold = isSideYaw && isUpPitch ? 0.10 : isSideYaw || isUpPitch ? 0.14 : 0.18

  const selectedCaptures = (snapshot?.selectedCaptures || (snapshot?.coverageBins || []).filter((b: any) => b?.filled && b?.image)) as Array<{ key: string; bestQuality: number; image: string; selectedPath?: string }>
  
  const checks = [
    { label: 'Face detected', passed: quality.face_present >= 0.5 },
    { label: 'Face centered', passed: quality.face_centered >= centeredThreshold },
    { label: 'Face scale', passed: quality.face_scale >= scaleThreshold },
    { label: 'Brightness', passed: quality.brightness >= 0.22 },
    { label: 'Sharpness', passed: (quality.blur_proxy || quality.sharpness || 0) >= sharpnessThreshold },
    { label: 'Stability', passed: quality.stability >= stabilityThreshold },
  ]

  const gateStatus = snapshot?.gate?.accepted ? 'accepted' : (snapshot?.gate?.decisionReason || 'idle')

  return (
    <section className="flex flex-col h-full rounded-3xl border border-orange-500/30 bg-gradient-to-br from-black/80 to-black/60 p-6 shadow-2xl backdrop-blur-xl md:p-7">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 flex-shrink-0">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-orange-400/90">
            Hidden Realtime Pipeline (Python Backend)
          </p>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold text-orange-50">
            Tracking, gating, and AI guidance
          </h2>
        </div>

        <span
          className={clsx(
            'rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] whitespace-nowrap border',
            stateTheme[snapshot?.state] || stateTheme.idle,
          )}
        >
          {snapshot?.state || 'idle'}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] xl:items-stretch">
            <div className="space-y-5">
              <DebugVideoOverlay
                videoRef={videoRef}
                track={snapshot?.landmarks ? { landmarks: snapshot.landmarks } : null}
                isRunning={isRunning}
              />

              <section className="rounded-2xl border border-orange-400/30 bg-orange-600/15 p-4">
                <header className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-orange-300/90">Coverage Map</h3>
                  <span className="font-mono text-sm font-bold text-orange-400">{Math.round((snapshot?.progress || 0) * 100)}%</span>
                </header>
                <div className="space-y-2">
                  {pitchOrder.map((pitch) => (
                    <div key={pitch} className="grid grid-cols-3 gap-2">
                      {yawOrder.map((yaw) => {
                        const key = `${yaw}_${pitch}`;
                        const bin = (snapshot?.coverageBins || []).find((b: any) => b.key === key);
                        const filled = Boolean(bin?.filled);
                        return (
                          <div key={key} className={clsx('relative overflow-hidden rounded-lg border px-2 py-2 text-center text-[11px] uppercase tracking-[0.08em] font-bold transition-all duration-200 min-h-[60px] flex items-center justify-center', filled ? 'border-orange-400/50 bg-orange-600/30 text-orange-100' : 'border-orange-300/20 bg-black/40 text-orange-200/60 hover:bg-orange-600/15')}>
                            {filled && bin?.image && (
                              <img src={`data:image/jpeg;base64,${bin.image}`} alt={key} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen" />
                            )}
                            <div className="relative z-10 flex flex-col items-center justify-center w-full drop-shadow-md">
                              <span className="bg-black/40 px-1 rounded">{yaw}</span>
                              <span className="font-mono text-[10px] text-orange-100/90 mt-1 bg-black/40 px-1 rounded">{filled ? formatScore(bin?.bestQuality ?? 0) : '--'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-orange-400/30 bg-orange-600/15 p-4">
                <header className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-orange-300/90">Selected Capture Images</h3>
                  <span className="text-xs font-mono text-orange-200/80">{selectedCaptures.length} selected</span>
                </header>


              {selectedCaptures.length === 0 ? (
                <div className="rounded-lg border border-orange-300/20 bg-black/40 px-3 py-4 text-xs text-orange-200/60">
                  No captures selected yet.
                </div>
              ) : (
                <div className="pr-1">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selectedCaptures.map((capture) => (
                      <article key={capture.key} className="overflow-hidden rounded-lg border border-orange-400/35 bg-black/50">
                        <img
                          src={`data:image/jpeg;base64,${capture.image}`}
                          alt={capture.key}
                          className="h-20 w-full object-cover"
                        />
                        <div className="px-2 py-1 text-[10px]">
                          <p className="font-mono uppercase text-orange-100">{capture.key}</p>
                          <p className="text-orange-200/70">Q {formatScore(capture.bestQuality ?? 0)}</p>
                          {capture.selectedPath && (
                            <p className="truncate text-[9px] text-orange-200/55">{capture.selectedPath}</p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-orange-400/30 bg-orange-600/15 p-3">
              <MetricCard label="Yaw" value={snapshot?.pose ? formatPose(snapshot.pose.yaw) : '--'} />
              <MetricCard label="Pitch" value={snapshot?.pose ? formatPose(snapshot.pose.pitch) : '--'} />
              <MetricCard label="Roll" value={snapshot?.pose ? formatPose(snapshot.pose.roll) : '--'} />
            </div>

            <div className="rounded-2xl border border-orange-400/30 bg-orange-600/15 p-4">
              <h3 className="mb-3 text-xs uppercase tracking-[0.15em] font-bold text-orange-300/90">Eligibility Checklist</h3>
              <div className="grid gap-2 text-sm">
                {checks.map((item) => (
                  <div key={item.label} className={clsx('flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-200 border', item.passed ? 'bg-orange-600/30 text-orange-100 border-orange-400/40' : 'bg-red-600/20 text-red-100 border-red-400/30')}>
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs font-bold uppercase">{item.passed ? '✓ pass' : '✗ fail'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-orange-400/30 bg-orange-600/15 p-4 text-sm text-orange-100/80 space-y-2">
              <h3 className="mb-3 text-xs uppercase tracking-[0.15em] font-bold text-orange-300/90">Audio Guide Activity</h3>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p>
                    <span className="text-orange-300/90 font-bold">Status:</span>{' '}
                    <span className="font-mono text-orange-200">
                      {!audioGuideEnabled ? 'off' : (isSpeaking ? 'speaking' : 'ready')}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-orange-100/65">
                    {audioGuideEnabled ? 'Wave animates while prompts are spoken.' : 'Enable Audio Guide on the mobile panel.'}
                  </p>
                </div>

                <AudioWave active={audioGuideEnabled && isSpeaking} />
              </div>
            </div>

            <div className="rounded-2xl border border-orange-400/30 bg-orange-600/15 p-4 text-sm text-orange-100/80 space-y-2">
              <h3 className="mb-3 text-xs uppercase tracking-[0.15em] font-bold text-orange-300/90">Gate Decision & LLM Context</h3>
              <div className="space-y-1.5">
                <p><span className="text-orange-300/90 font-bold">Status:</span> <span className="font-mono text-orange-400">{gateStatus}</span></p>
                <p><span className="text-orange-300/90 font-bold">Reason:</span> {snapshot?.gate?.decisionReason || '--'}</p>
                <p><span className="text-orange-300/90 font-bold">Target bin:</span> <span className="font-mono text-orange-200">{targetBin}</span></p>
                <p><span className="text-orange-300/90 font-bold">LLM State:</span> {snapshot?.prompt?.reason || '--'}</p>
              </div>
            </div>

            <section className="rounded-2xl border border-orange-400/30 bg-orange-600/15 p-4">
              <h3 className="mb-3 text-xs uppercase tracking-[0.15em] font-bold text-orange-300/90">Quality Scores (Normalized)</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <ScoreChip label="Centered" value={quality.face_centered} />
                <ScoreChip label="Scale" value={quality.face_scale} />
                <ScoreChip label="Stability" value={quality.stability} />
                <ScoreChip label="Sharpness" value={quality.blur_proxy || quality.sharpness} />
                <div className="col-span-2">
                  <ScoreChip label="Overall Quality" value={quality.overall} emphasize />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </section>
  )
}

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <article className="rounded-lg border border-orange-400/30 bg-gradient-to-br from-black/60 to-black/40 p-2.5 backdrop-blur">
    <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-orange-300/90">{label}</p>
    <p className="mt-1 font-mono text-sm font-bold text-orange-400">{value}</p>
  </article>
)

const ScoreChip = ({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) => (
  <article className={clsx('rounded-lg border px-3 py-2 backdrop-blur transition-all duration-200', emphasize ? 'border-orange-400/50 bg-gradient-to-br from-orange-600/40 to-orange-500/30 shadow-lg' : 'border-orange-400/30 bg-gradient-to-br from-black/60 to-black/40 hover:border-orange-400/50')}>
    <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-orange-300/90">{label}</p>
    <p className="font-mono text-sm font-bold text-orange-100 mt-1">{formatScore(value)}</p>
  </article>
)

const AudioWave = ({ active }: { active: boolean }) => (
  <div className="flex h-8 items-end gap-1 rounded-md border border-orange-400/30 bg-black/40 px-2 py-1">
    {Array.from({ length: 10 }).map((_, index) => (
      <span
        key={index}
        className={clsx('audio-wave-bar', active ? 'audio-wave-bar-active' : 'audio-wave-bar-idle')}
        style={{ animationDelay: `${index * 0.08}s` }}
      />
    ))}
  </div>
)
