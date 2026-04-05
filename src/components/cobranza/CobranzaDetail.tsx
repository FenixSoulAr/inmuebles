import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { EnrichedRentDue, RentPayment } from '@/hooks/useCobranza'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  due: EnrichedRentDue | null
  fetchPagos: (rentDueId: string) => Promise<RentPayment[]>
  onRegisterPayment: () => void
}

const statusVariant: Record<string, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  overdue: 'destructive', partial: 'warning', paid: 'success', upcoming: 'secondary',
}

export default function CobranzaDetail({ open, onOpenChange, due, fetchPagos, onRegisterPayment }: Props) {
  const { t } = useTranslation()
  const [pagos, setPagos] = useState<RentPayment[]>([])

  useEffect(() => {
    if (open && due) {
      fetchPagos(due.id).then(setPagos)
    } else {
      setPagos([])
    }
  }, [open, due])

  if (!due) return null

  const methodLabel: Record<string, string> = {
    transfer: t('billing.methods.transfer'),
    cash: t('billing.methods.cash'),
    check: t('billing.methods.check'),
    other: t('billing.methods.other'),
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{due.tenant_name}</SheetTitle>
          <SheetDescription>{due.property_address}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">{t('billing.columns.period')}:</span> <span className="font-medium">{due.period_month}</span></div>
            <div><span className="text-muted-foreground">{t('billing.detail.dueDate')}:</span> <span className="font-medium">{formatDate(due.due_date)}</span></div>
            <div><span className="text-muted-foreground">{t('billing.detail.expected')}:</span> <span className="font-medium">{formatCurrency(Number(due.expected_amount), due.currency)}</span></div>
            <div>
              <span className="text-muted-foreground">{t('billing.columns.status')}:</span>{' '}
              <Badge variant={statusVariant[due.display_status] ?? 'secondary'}>{t(`billing.status.${due.display_status}`)}</Badge>
            </div>
          </div>

          <Separator />

          <div className="rounded-md border p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('billing.columns.balance')}</span>
              <span className={`font-medium ${due.display_status === 'overdue' ? 'text-destructive' : ''}`}>{formatCurrency(Number(due.balance_due), due.currency)}</span>
            </div>
            {due.display_status === 'overdue' && due.days_overdue > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('billing.columns.daysOverdue')}</span>
                <span className="font-medium text-destructive">{due.days_overdue} {t('billing.detail.days')}</span>
              </div>
            )}
            {due.display_status === 'overdue' && due.interest_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('billing.columns.interest')}</span>
                <span className="font-medium text-orange-600">{formatCurrency(due.interest_amount, due.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1">
              <span className="font-semibold">{t('billing.columns.totalDue')}</span>
              <span className="font-bold">{formatCurrency(due.total_due, due.currency)}</span>
            </div>
          </div>

          {due.grace_days > 0 && due.display_status === 'overdue' && due.days_overdue === 0 && (
            <p className="text-sm text-muted-foreground italic">{t('billing.detail.gracePeriod')}</p>
          )}

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">{t('billing.detail.paymentHistory')}</h4>
            {pagos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('billing.detail.noPayments')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('billing.detail.payDate')}</TableHead>
                    <TableHead className="text-right">{t('billing.detail.payAmount')}</TableHead>
                    <TableHead>{t('billing.payForm.method')}</TableHead>
                    <TableHead>{t('billing.payForm.notes')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(Number(p.amount), due.currency)}</TableCell>
                      <TableCell className="text-xs">{methodLabel[p.method] ?? p.method}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {due.display_status !== 'paid' && (
            <Button onClick={onRegisterPayment} className="w-full">
              <DollarSign className="h-4 w-4 mr-1" />{t('billing.payForm.submit')}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
