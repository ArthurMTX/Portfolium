interface PinkProgressProps {
  value: number
  className?: string
}

export default function PinkProgress({ value, className = '' }: PinkProgressProps) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div className={`w-full h-3 bg-neutral-200 dark:bg-neutral-800 rounded-2xl overflow-hidden ${className}`}>
      <div
        className="h-3 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 transition-[width] duration-700 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
