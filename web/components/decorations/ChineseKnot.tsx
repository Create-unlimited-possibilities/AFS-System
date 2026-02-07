export default function ChineseKnot({ className = '', size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L14 8H20L15 12L17 18L12 14L7 18L9 12L4 8H10L12 2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="2" r="1.5" fill="currentColor" />
      <circle cx="20" cy="8" r="1.5" fill="currentColor" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" />
      <circle cx="7" cy="18" r="1.5" fill="currentColor" />
      <circle cx="4" cy="8" r="1.5" fill="currentColor" />
    </svg>
  )
}
