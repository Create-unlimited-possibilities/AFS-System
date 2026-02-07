export default function CircleFrame({ className = '', size = 200, strokeWidth = 2 }: { className?: string; size?: number; strokeWidth?: number }) {
  const center = size / 2
  const radius = (size - strokeWidth * 2) / 2

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={center}
        cy={center}
        r={radius - strokeWidth * 2}
        stroke="currentColor"
        strokeWidth={strokeWidth / 2}
        fill="none"
        opacity="0.5"
      />
    </svg>
  )
}
