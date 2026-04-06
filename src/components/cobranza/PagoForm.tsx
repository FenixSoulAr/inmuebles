import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/utils'
import type { EnrichedRentDue } from '@/hooks/useCobranza'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  due: EnrichedRentDue | null
  onSave: (rentDueId: string, data: { amount: number; method: string; payment_date: string; notes: string }) => Promise<void>
}

export default function PagoForm({ open, onOpenChange, due, onSave }: Props) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ canonAcordado: '', amount: '', method: 'transfer', payment_date: today, notes: '' })

  // Reset form when due changes
  const [lastDueId, setLastDueId] = useState<string | null>(null)
  if (due && due.id !== lastDueId) {
    setLastDueId(due.id)
    setForm({
      canonAcordado: String(due.expected_amount),
      amount: String(due.total_due),
      method: 'transfer',
      payment_date: today,
      notes: '',
    })
  }

  // Dynamic interest calculation based on payment_date
  const interestCalc = useMemo(() => {
    if (!due) return { daysLate: 0, interest: 0, hasRate: false }
    const dueDate = new Date(due.due_date)
    const payDate = new Date(form.payment_date)
    const diffMs = payDate.getTime() - dueDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const daysLate = Math.max(0, diffDays - due.grace_days)
    const canon = parseFloat(form.canonAcordado) || 0
    const hasRate = due.interest_rate !== null && due.interest_rate > 0
    const interest = hasRate && daysLate > 0
      ? Math.round(canon * ((due.interest_rate ?? 0) / 100) * (daysLate / 30) * 100) / 100
      : 0
    return { daysLate, interest, hasRate }
  }, [due, form.payment_date, form.canonAcordado])

  // Update amount when interest calc changes
  const [lastCalcKey, setLastCalcKey] = useState('')
  if (due) {
    const calcKey = `${form.payment_date}-${form.canonAcordado}`
    if (calcKey !== lastCalcKey) {
      setLastCalcKey(calcKey)
      const canon = parseFloat(form.canonAcordado) || 0
      const newDefault = Math.round((Number(due.balance_due) + interestCalc.interest) * 100) / 100
      setForm(f => ({ ...f, amount: String(newDefault > 0 ? newDefault : canon) }))
    }
  }

  if (!due) return null

  const handleSubmit = async () => {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return
    setSaving(true)
    try {
      await onSave(due.id, { amount, method: form.method, payment_date: form.payment_date, notes: form.notes })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('billing.payForm.title')} — {due.tenant_name}</SheetTitle>
          <SheetDescription>{due.property_address}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Readonly info */}
          <div className="rounded-md border p-3 space-y-1 text-sm bg-muted/30">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('billing.columns.period')}</span><span className="font-medium">{due.period_month}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('billing.columns.balance')}</span><span className="font-medium">{formatCurrency(Number(due.balance_due), due.currency)}</span></div>
            <div className="flex justify-between border-t pt-1">
              <span className="font-semibold">{t('billing.payForm.referenceTotal')}</span>
              <span className="font-bold">{formatCurrency(due.total_due, due.currency)}</span>
            </div>
            <p className="text-xs text-muted-foreground italic">{t('billing.payForm.referenceTotalHint')}</p>
          </div>

          {/* Payment date — first editable field */}
          <div className="space-y-2">
            <Label>{t('billing.payForm.dateQuestion')}</Label>
            <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>

          {/* Dynamic interest feedback */}
          <div className="rounded-md border p-3 text-sm">
            {interestCalc.daysLate === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{t('billing.payForm.noLate')}</span>
              </div>
            ) : interestCalc.hasRate ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">
                    {interestCalc.daysLate} {t('billing.detail.days')} {t('billing.payForm.lateLabel')} — {t('billing.payForm.estimatedInterest')}: {formatCurrency(interestCalc.interest, due.currency)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t('billing.payForm.interestHint')}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                <span>{interestCalc.daysLate} {t('billing.detail.days')} {t('billing.payForm.lateLabel')} — {t('billing.payForm.noRateConfigured')}</span>
              </div>
            )}
          </div>

          {/* Canon acordado */}
          <div className="space-y-2">
            <Label>{t('billing.payForm.agreedCanon')}</Label>
            <Input type="number" step="0.01" min="0" value={form.canonAcordado} onChange={e => setForm(f => ({ ...f, canonAcordado: e.target.value }))} />
          </div>

          {/* Monto recibido */}
          <div className="space-y-2">
            <Label>{t('billing.payForm.amountReceived')} *</Label>
            <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>{t('billing.payForm.method')}</Label>
            <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transfer">{t('billing.methods.transfer')}</SelectItem>
                <SelectItem value="cash">{t('billing.methods.cash')}</SelectItem>
                <SelectItem value="check">{t('billing.methods.check')}</SelectItem>
                <SelectItem value="other">{t('billing.methods.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('billing.payForm.notes')}</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('billing.payForm.notesPlaceholder')} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !parseFloat(form.amount) || parseFloat(form.amount) <= 0}>
            {saving ? t('common.saving') : t('billing.payForm.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
