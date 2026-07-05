interface FlowerMarkProps {
  className?: string
}

export default function FlowerMark({ className = '' }: FlowerMarkProps) {
  return (
    <img
      className={`auth-flower ${className}`.trim()}
      src="/favicon.svg"
      alt=""
      aria-hidden="true"
      loading="eager"
      draggable={false}
    />
  )
}
