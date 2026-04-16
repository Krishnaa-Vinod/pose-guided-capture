import { useCallback, useRef, useState } from 'react'

const WEBSOCKET_URL = 'ws://localhost:8000/ws/enrollment'
const CAPTURE_WIDTH = 640
const CAPTURE_HEIGHT = 480
const CAPTURE_QUALITY = 0.82
const TARGET_FPS = 12
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS

export const useRemoteEnrollmentSession = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const socketRef = useRef<WebSocket | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameSentAtRef = useRef<number>(0)

  const [snapshot, setSnapshot] = useState<unknown>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    setIsRunning(false)

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    const stream = videoRef.current?.srcObject as MediaStream
    stream?.getTracks().forEach(track => track.stop())
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const streamFrames = useCallback((timestamp: number = 0) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      animationFrameRef.current = null
      return
    }

    const video = videoRef.current
    if (video && video.readyState >= 2 && timestamp - lastFrameSentAtRef.current >= FRAME_INTERVAL_MS) {
      const canvas = canvasRef.current
      canvas.width = CAPTURE_WIDTH
      canvas.height = CAPTURE_HEIGHT

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frame = canvas.toDataURL('image/jpeg', CAPTURE_QUALITY)
        socket.send(JSON.stringify({ type: 'frame', frame }))
        lastFrameSentAtRef.current = timestamp
      }
    }

    animationFrameRef.current = requestAnimationFrame(streamFrames)
  }, [])

  const start = useCallback(async () => {
    setIsStarting(true)
    setError(null)
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const socket = new WebSocket(WEBSOCKET_URL)
      socketRef.current = socket

      socket.onopen = () => {
        setIsRunning(true)
        setIsStarting(false)
        lastFrameSentAtRef.current = -FRAME_INTERVAL_MS
        animationFrameRef.current = requestAnimationFrame(streamFrames)
      }

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setSnapshot(data)
        if (data.state === 'completed') {
          setTimeout(stop, 3000)
        }
      }

      socket.onerror = () => {
        setError('WebSocket connection error')
        setIsStarting(false)
        stop()
      }

      socket.onclose = () => {
        setIsRunning(false)
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
      }

    } catch {
      setError('Webcam access denied')
      setIsStarting(false)
    }
  }, [stop, streamFrames])

  const restart = useCallback(async () => {
    stop()
    await start()
  }, [start, stop])

  return {
    videoRef,
    snapshot,
    isRunning,
    isStarting,
    error,
    start,
    stop,
    restart
  }
}
