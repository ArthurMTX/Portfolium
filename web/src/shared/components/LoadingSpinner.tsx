import React from 'react'
import { Loader } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'border' | 'icon'
  color?: 'pink' | 'blue' | 'white' | 'indigo'
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  variant = 'border',
  color = 'pink',
  className = '' 
}) => {
  // Size mappings for border variant
  const borderSizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  }

  // Size mappings for icon variant
  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32
  }

  // Color mappings
  const borderColors = {
    pink: 'border-pink-600',
    blue: 'border-blue-600',
    white: 'border-white',
    indigo: 'border-indigo-600'
  }

  const iconColors = {
    pink: 'text-pink-600',
    blue: 'text-blue-600',
    white: 'text-white',
    indigo: 'text-indigo-600'
  }

  if (variant === 'icon') {
    return (
      <Loader 
        className={`animate-spin ${iconColors[color]} ${className}`}
        size={iconSizes[size]}
      />
    )
  }

  return (
    <div 
      className={`animate-spin rounded-full border-b-2 ${borderSizes[size]} ${borderColors[color]} ${className}`}
    />
  )
}

export default LoadingSpinner
