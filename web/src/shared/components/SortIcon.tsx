import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'

interface SortIconProps<T extends string = string> {
  column: T
  activeColumn: T
  direction: 'asc' | 'desc'
}

/**
 * Reusable sort icon component for table headers
 * Shows ArrowUpDown when inactive, ChevronUp/Down when active
 */
export default function SortIcon<T extends string = string>({ 
  column, 
  activeColumn, 
  direction 
}: SortIconProps<T>) {
  const active = activeColumn === column
  
  if (!active) {
    return <ArrowUpDown size={14} className="inline ml-1 opacity-40" />
  }
  
  return direction === 'asc' ? (
    <ChevronUp size={14} className="inline ml-1 opacity-80" />
  ) : (
    <ChevronDown size={14} className="inline ml-1 opacity-80" />
  )
}
