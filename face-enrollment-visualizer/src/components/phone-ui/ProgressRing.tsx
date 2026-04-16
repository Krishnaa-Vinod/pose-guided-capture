interface ProgressRingProps {
  progress: number
  size?: number
  stroke?: number
}

export const ProgressRing = ({
  progress,
  size = 220,
  stroke = 8,
}: ProgressRingProps) => {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - Math.max(0, Math.min(1, progress)) * circumference

  return (
    <svg
      aria-hidden
      className="pointer-events-none"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="url(#progressGradient)"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7cf8f2" />
          <stop offset="100%" stopColor="#ffd18b" />
        </linearGradient>
      </defs>
    </svg>
  )
}
