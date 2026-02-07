export default function DoubleHappiness({ className = '', size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M7 3H9V5H7V3ZM7 7H9V9H7V7ZM15 3H17V5H15V3ZM15 7H17V9H15V7ZM5 11H7V13H5V11ZM17 11H19V13H17V11ZM3 15H5V17H3V15ZM19 15H21V17H19V15ZM7 19H9V21H7V19ZM15 19H17V21H15V19Z" />
      <path d="M11 5H13V7H11V5ZM11 9H13V11H11V9ZM7 11H9V13H7V11ZM15 11H17V13H15V11ZM11 11H13V13H11V11ZM11 15H13V17H11V15Z" />
    </svg>
  )
}
