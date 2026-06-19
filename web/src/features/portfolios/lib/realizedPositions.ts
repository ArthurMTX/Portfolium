import { PositionDTO } from '@/api'

export function getRealizedPositions(
  currentPositions: PositionDTO[],
): PositionDTO[] {
  return currentPositions.filter(
    (position) => Number(position.quantity) > 0 && Number(position.realized_quantity) > 0,
  )
}
