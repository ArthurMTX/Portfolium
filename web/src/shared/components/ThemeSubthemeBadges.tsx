interface SubthemeBadge {
  label: string
  confidence: number
  evidence?: string[] | null
}

export default function ThemeSubthemeBadges({
  parentLabel,
  subthemes,
}: {
  parentLabel: string
  subthemes?: SubthemeBadge[] | null
}) {
  if (!subthemes || subthemes.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {subthemes.map((subtheme) => (
        <span
          key={`${parentLabel}-${subtheme.label}`}
          className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300"
          title={subtheme.evidence?.length ? subtheme.evidence.join('\n') : undefined}
        >
          {subtheme.label} {Math.round(subtheme.confidence * 100)}%
        </span>
      ))}
    </div>
  )
}
