import { useEffect, useState } from 'react'

/**
 * Reads whether dark mode is active from the one universally-reliable
 * signal in this app: the `dark` class on <html> (Tailwind's `darkMode:
 * 'class'` config). Reactive via MutationObserver so it stays in sync with
 * whichever of the app's independent theme toggles flips that class.
 */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'))
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}
