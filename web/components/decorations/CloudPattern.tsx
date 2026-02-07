export default function CloudPattern({ className = '', opacity = 0.1 }: { className?: string; opacity?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity }}
    >
      <path
        d="M20 50C20 27.9086 37.9086 10 60 10C75.1522 10 88.3696 18.1915 95.5 30.5C102.63 18.1915 115.848 10 131 10C153.091 10 171 27.9086 171 50C171 72.0914 153.091 90 131 90C115.848 90 102.63 81.8085 95.5 69.5C88.3696 81.8085 75.1522 90 60 90C37.9086 90 20 72.0914 20 50Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}
