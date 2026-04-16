import { useEffect, useRef } from 'react'

interface DebugVideoOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  track: { landmarks: Array<{ x: number, y: number }> } | null
  isRunning: boolean
}

export const DebugVideoOverlay = ({
  videoRef,
  track,
  isRunning,
}: DebugVideoOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackRef = useRef<{ landmarks: Array<{ x: number, y: number }> } | null>(track)

  useEffect(() => {
    trackRef.current = track
  }, [track])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    let animationId: number | null = null

    const draw = () => {
      const currentCanvas = canvasRef.current
      const video = videoRef.current
      if (!currentCanvas || !context) {
        return
      }

      const displayWidth = currentCanvas.clientWidth
      const displayHeight = currentCanvas.clientHeight
      const dpr = window.devicePixelRatio || 1

      if (
        currentCanvas.width !== Math.floor(displayWidth * dpr) ||
        currentCanvas.height !== Math.floor(displayHeight * dpr)
      ) {
        currentCanvas.width = Math.floor(displayWidth * dpr)
        currentCanvas.height = Math.floor(displayHeight * dpr)
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, displayWidth, displayHeight)

      const drawConfig = {
        offsetX: 0,
        offsetY: 0,
        width: displayWidth,
        height: displayHeight,
      }

      if (video && video.readyState >= 2) {
        const videoWidth = video.videoWidth
        const videoHeight = video.videoHeight
        const videoAspect = videoWidth / videoHeight
        const canvasAspect = displayWidth / displayHeight

        if (videoAspect > canvasAspect) {
          drawConfig.height = displayHeight
          drawConfig.width = displayHeight * videoAspect
          drawConfig.offsetX = (displayWidth - drawConfig.width) / 2
        } else {
          drawConfig.width = displayWidth
          drawConfig.height = displayWidth / videoAspect
          drawConfig.offsetY = (displayHeight - drawConfig.height) / 2
        }

        context.save()
        context.scale(-1, 1)
        context.drawImage(
          video,
          -drawConfig.width - drawConfig.offsetX,
          drawConfig.offsetY,
          drawConfig.width,
          drawConfig.height,
        )
        context.restore()
      } else {
        context.fillStyle = '#050b15'
        context.fillRect(0, 0, displayWidth, displayHeight)

        context.fillStyle = 'rgba(251, 191, 36, 0.55)'
        context.font = '600 13px "Space Grotesk", sans-serif'
        context.textAlign = 'center'
        context.fillText(
          isRunning ? 'Waiting for camera frame...' : 'Start enrollment to preview camera',
          displayWidth / 2,
          displayHeight / 2,
        )
      }

      context.strokeStyle = 'rgba(255,255,255,0.24)'
      context.lineWidth = 1.5
      context.beginPath()
      context.arc(displayWidth / 2, displayHeight / 2, 78, 0, Math.PI * 2)
      context.stroke()

      const currentTrack = trackRef.current
      if (currentTrack && currentTrack.landmarks) {
        context.fillStyle = 'rgba(124,248,242,0.9)'
        for (const point of currentTrack.landmarks) {
          context.beginPath()
          // Backend landmarks are normalized 0-1
          const lx = drawConfig.offsetX + (1 - point.x) * drawConfig.width
          const ly = drawConfig.offsetY + point.y * drawConfig.height
          context.arc(lx, ly, 1.2, 0, Math.PI * 2)
          context.fill()
        }
      }

      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isRunning, videoRef])

  return (
    <div className="overflow-hidden rounded-2xl border border-orange-500/40 bg-black/70 shadow-lg">
      <canvas
        ref={canvasRef}
        className="block w-full aspect-video max-h-[340px] bg-[#040b15]"
      />
    </div>
  )
}
