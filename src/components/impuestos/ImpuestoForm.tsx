import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import type { TaxInsert, TaxObligation } from '@/hooks/useImpuestos'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (data: TaxInsert) => Promise<void>
  editing?: TaxObligation | null
}

const TYPE_OPTIONS = ['municipal', 'property', 'provincial', 'other'] as const
const RESPONSIBLE_OPTIONS = ['owner', 'tenant'] as const
const FREQUENCY_OPTIONS = ['monthly', 'bimonthly', 'annual', 'one-time'] as const

export default function ImpuestoForm({ open, onOpenChange, onSave, editing }: Props) {
  const { t } = useTranslation()
  const { projectId } = useProjectId()
  const [properties, setProperties] = useState<{ id: string; full_address: string }[]>([])
  const [saving, setSaving] = useState(false)

  const [propertyId, setPropertyId] = useState('')
  const [type, setType] = useState<string>('municipal')
  const [responsible, setResponsible] = useState<string>('owner')
  const [frequency, setFrequency] = useState<string>('annual')
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!projectId || !open) return
    supabase
      .from('properties')
      .select('id, full_address')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('full_address')
      .then(({ data }) => setProperties(data ?? []))
  }, [projectId, open])

  useEffect(() => {
    if (editing) {
      setPropertyId(editing.property_id)
      setType(editing.type)
      setResponsible(editing.responsible)
      setFrequency(editing.frequency)
      setDueDate(editing.due_date)
      setAmount(editing.amount != null ? String(editing.amount) : '')
      setNotes(editing.notes ?? '')
      setActive(editing.active)
    } else {
      setPropertyId('')
      setType('municipal')
      setResponsible('owner')
      setFrequency('annual')
      setDueDate(new Date().toISOString().slice(0, 10))
      setAmount('')
      setNotes('')
      setActive(true)
    }
  }, [editing, open])

  const valid = propertyId && type && responsible && frequency && dueDate

  const handleSubmit = async () => {
    if (!valid) return
    setSaving(true)
    await onSave({
      property_id: propertyId,
      type,
      responsible,
      frequency,
      due_date: dueDate,
      amount: amount ? Number(amount) : null,
      notes: notes || null,
      active,
    })
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? t('taxes.form.editTitle') : t('taxes.form.createTitle')}</SheetTitle>
          <SheetDescription>{editing ? t('taxes.form.editDesc') : t('taxes.form.createDesc')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div>
            <Label>{t('taxes.form.property')}</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue placeholder={t('taxes.form.selectProperty')} /></SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('taxes.form.type')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(o => (
                  <SelectItem key={o} value={o}>{t(`taxes.types.${o}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('taxes.form.responsible')}</Label>
            <Select value={responsible} onValueChange={setResponsible}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESPONSIBLE_OPTIONS.map(o => (
                  <SelectItem key={o} value={o}>{t(`taxes.responsible.${o}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('taxes.form.frequency')}</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map(o => (
                  <SelectItem key={o} value={o}>{t(`taxes.frequencies.${o}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('taxes.form.dueDate')}</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div>
            <Label>{t('taxes.form.amount')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={t('taxes.form.amountPlaceholder')}
            />
          </div>

          <div>
            <Label>{t('taxes.form.notes')}</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('taxes.form.notesPlaceholder')}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="rounded border-input"
              id="tax-active"
            />
            <Label htmlFor="tax-active">{t('taxes.form.active')}</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSubmit} disabled={!valid || saving} className="flex-1">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
