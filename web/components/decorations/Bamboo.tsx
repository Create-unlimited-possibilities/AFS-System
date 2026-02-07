export default function Bamboo({ className = '', size = 24 }: { className?: string; size?: number }) {
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
        d="M8 2V22M8 6L12 4M8 11L13 9M8 16L14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 6C8 6 6 6 6 8C6 10 10 10 10 8C10 6 8 6 8 6Z"
        fill="currentColor"
      />
      <path
        d="M8 11C8 11 6 11 6 13C6 15 11 15 11 13C11 11 9 11 9 11Z"
        fill="currentColor"
      />
      <path
        d="M8 16C8 16 6 16 6 18C6 20 12 20 12 18C12 16 10 16 10 16Z"
        fill="currentColor"
      />
      <path
        d="M16 2V22M16 8L20 6M16 14L21 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 8C16 8 14 8 14 10C14 12 18 12 18 10C18 8 16 8 16 8Z"
        fill="currentColor"
      />
      <path
        d="M16 14C16 14 14 14 14 16C14 18 19 18 19 16C19 14 17 14 17 14Z"
        fill="currentColor"
      />
    </svg>
  )
}
