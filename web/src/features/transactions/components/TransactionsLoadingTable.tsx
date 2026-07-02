import { useTranslation } from 'react-i18next'
import { TableSkeleton } from '@/shared/components/StatePrimitives'

export default function TransactionsLoadingTable() {
  const { t } = useTranslation()

  return <TableSkeleton rows={5} columns={9} label={t('common.loading')} />
}
