import type { Layout } from 'react-grid-layout'

export type DashboardBreakpoint = 'lg' | 'md' | 'sm'

export function cleanLayout(layout: Layout[]): Layout[] {
  return layout.map(item => {
    const cleaned: Layout = {
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }

    if (typeof item.minW === 'number' && isFinite(item.minW)) {
      cleaned.minW = item.minW
    }
    if (typeof item.minH === 'number' && isFinite(item.minH)) {
      cleaned.minH = item.minH
    }
    if (typeof item.maxW === 'number' && isFinite(item.maxW)) {
      cleaned.maxW = item.maxW
    }
    if (typeof item.maxH === 'number' && isFinite(item.maxH)) {
      cleaned.maxH = item.maxH
    }

    return cleaned
  })
}

export function compactLayout(layout: Layout[], breakpoint: DashboardBreakpoint): Layout[] {
  if (!layout || layout.length === 0) {
    return layout
  }

  const sorted = cleanLayout(layout).sort((a, b) => {
    if (a.y === b.y) return a.x - b.x
    return a.y - b.y
  })

  const cols = breakpoint === 'lg' ? 12 : breakpoint === 'md' ? 8 : 4
  const grid: boolean[][] = []

  const ensureGridRow = (row: number) => {
    if (!grid[row]) grid[row] = Array(cols).fill(false)
  }

  const isPositionAvailable = (x: number, y: number, w: number, h: number): boolean => {
    for (let dy = 0; dy < h; dy++) {
      const row = y + dy
      ensureGridRow(row)

      for (let dx = 0; dx < w; dx++) {
        const col = x + dx
        if (col >= cols || grid[row][col]) {
          return false
        }
      }
    }

    return true
  }

  const markOccupied = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) {
      const row = y + dy
      ensureGridRow(row)

      for (let dx = 0; dx < w; dx++) {
        const col = x + dx
        if (col < cols) {
          grid[row][col] = true
        }
      }
    }
  }

  return sorted.map(item => {
    let targetY = 0

    while (targetY < 1000) {
      if (isPositionAvailable(item.x, targetY, item.w, item.h)) {
        break
      }
      targetY++
    }

    markOccupied(item.x, targetY, item.w, item.h)

    return {
      ...item,
      y: targetY,
    }
  })
}
