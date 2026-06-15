import { Layout } from 'react-grid-layout'

interface DashboardSkeletonProps {
  layout: Layout[]
  cols: number
  rowHeight: number
}

export default function DashboardSkeleton({ layout, cols, rowHeight }: DashboardSkeletonProps) {
  // Calculate the total height needed for the container
  // Find the bottom-most widget (max y + h)
  const totalHeight = layout.reduce((maxHeight, item) => {
    const itemBottom = item.y * rowHeight + (item.y * 20) + item.h * rowHeight + ((item.h - 1) * 20)
    return Math.max(maxHeight, itemBottom)
  }, 400) // Minimum 400px
  
  return (
    <div className="relative w-full" style={{ height: `${totalHeight}px`, minHeight: '400px' }}>
      {layout.map((item) => {
        // Calculate position and size based on grid layout
        const left = (item.x / cols) * 100
        const top = item.y * rowHeight + (item.y * 20) // 20px margin
        const width = (item.w / cols) * 100
        const height = item.h * rowHeight + ((item.h - 1) * 20) // Account for margins

        return (
          <div
            key={item.i}
            className="absolute animate-pulse"
            style={{
              left: `${left}%`,
              top: `${top}px`,
              width: `calc(${width}% - 20px)`, // Account for margin
              height: `${height}px`,
            }}
          >
            <div className="card h-full p-5">
              {/* Header skeleton */}
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
              </div>

              {/* Content skeleton - varies by widget size */}
              <div className="space-y-3">
                {/* Main content */}
                <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                
                {/* Additional lines for larger widgets */}
                {item.h > 2 && (
                  <>
                    <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
                    <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6"></div>
                  </>
                )}
                
                {item.h > 4 && (
                  <>
                    <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
                    <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-4/5"></div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
