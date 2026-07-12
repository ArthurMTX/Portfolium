import { useEffect, useState } from 'react'

export default function useAuthTheme() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('auth-theme')
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    if (!darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('auth-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('auth-theme', 'light')
    }
  }

  return { darkMode, toggleDarkMode }
}
