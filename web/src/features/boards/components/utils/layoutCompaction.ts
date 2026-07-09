import type { Layout } from 'react-grid-layout'

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
