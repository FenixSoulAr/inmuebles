import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const [form, setForm] = useState({ amount: '', method: 'transfer', payment_date: today, notes: '' })

  // Reset form when due changes
  const [lastDueId, setLastDueId] = useState<string | null>(null)
  if (due && due.id !== lastDueId) {
    setLastDueId(due.id)
    setForm({ amount: String(due.total_due), method: 'transfer', payment_date: today, notes: '' })
  }

  if (!due) return null

  const handleSubmit = async () => {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0 || amount > due.total_due) return
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
            {due.interest_amount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">{t('billing.columns.interest')}</span><span className="font-medium text-orange-600">{formatCurrency(due.interest_amount, due.currency)}</span></div>
            )}
            <div className="flex justify-between border-t pt-1"><span className="font-semibold">{t('billing.columns.totalDue')}</span><span className="font-bold">{formatCurrency(due.total_due, due.currency)}</span></div>
          </div>

          <div className="space-y-2">
            <Label>{t('billing.payForm.amount')} *</Label>
            <Input type="number" step="0.01" min="0.01" max={due.total_due} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
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
            <Label>{t('billing.payForm.date')}</Label>
            <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>{t('billing.payForm.notes')}</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('billing.payForm.notesPlaceholder')} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !parseFloat(form.amount) || parseFloat(form.amount) <= 0 || parseFloat(form.amount) > due.total_due}>
            {saving ? t('common.saving') : t('billing.payForm.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
