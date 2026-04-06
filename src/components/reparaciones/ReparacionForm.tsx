import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { supabase } from '@/integrations/supabase/client'
import type { EnrichedIssue } from '@/hooks/useReparaciones'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string | null
  issue: EnrichedIssue | null
  onSave: (data: any) => Promise<void>
}

export default function ReparacionForm({ open, onOpenChange, projectId, issue, onSave }: Props) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [properties, setProperties] = useState<{ id: string; full_address: string }[]>([])

  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    property_id: '',
    description: '',
    reported_at: today,
    status: 'open',
    requested_by: 'tenant',
    payer: 'owner',
    estimate_amount: '',
  })

  useEffect(() => {
    if (!open || !projectId) return
    supabase.from('properties').select('id, full_address').eq('project_id', projectId).eq('active', true).then(({ data }) => {
      setProperties(data ?? [])
    })
  }, [open, projectId])

  useEffect(() => {
    if (open && issue) {
      setForm({
        property_id: issue.property_id,
        description: issue.description,
        reported_at: issue.reported_at ? issue.reported_at.split('T')[0] : today,
        status: issue.status,
        requested_by: issue.requested_by,
        payer: issue.payer,
        estimate_amount: issue.estimate_amount != null ? String(issue.estimate_amount) : '',
      })
    } else if (open) {
      setForm({ property_id: '', description: '', reported_at: today, status: 'open', requested_by: 'tenant', payer: 'owner', estimate_amount: '' })
    }
  }, [open, issue])

  const handleSubmit = async () => {
    if (!form.property_id || !form.description.trim()) return
    setSaving(true)
    try {
      const payload = {
        property_id: form.property_id,
        description: form.description.trim(),
        reported_at: form.reported_at,
        status: form.status,
        requested_by: form.requested_by,
        payer: form.payer,
        estimate_amount: form.estimate_amount ? parseFloat(form.estimate_amount) : null,
      }
      await onSave(payload)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const isValid = form.property_id && form.description.trim()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{issue ? t('repairs.form.editTitle') : t('repairs.form.createTitle')}</SheetTitle>
          <SheetDescription>{issue ? t('repairs.form.editDesc') : t('repairs.form.createDesc')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Section 1 - Basic */}
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('repairs.form.sectionBasic')}</h4>

          <div className="space-y-2">
            <Label>{t('repairs.form.property')} *</Label>
            <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
              <SelectTrigger><SelectValue placeholder={t('repairs.form.selectProperty')} /></SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('repairs.form.description')} *</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('repairs.form.descriptionPlaceholder')} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('repairs.form.reportedAt')}</Label>
              <Input type="date" value={form.reported_at} onChange={e => setForm(f => ({ ...f, reported_at: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('repairs.form.status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('repairs.statuses.pending')}</SelectItem>
                  <SelectItem value="open">{t('repairs.statuses.open')}</SelectItem>
                  <SelectItem value="in_progress">{t('repairs.statuses.in_progress')}</SelectItem>
                  <SelectItem value="resolved">{t('repairs.statuses.resolved')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 2 - Responsibilities */}
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('repairs.form.sectionResponsibility')}</h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('repairs.form.requestedBy')}</Label>
              <Select value={form.requested_by} onValueChange={v => setForm(f => ({ ...f, requested_by: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{t('repairs.payers.owner')}</SelectItem>
                  <SelectItem value="tenant">{t('repairs.payers.tenant')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('repairs.form.payer')}</Label>
              <Select value={form.payer} onValueChange={v => setForm(f => ({ ...f, payer: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{t('repairs.payers.owner')}</SelectItem>
                  <SelectItem value="tenant">{t('repairs.payers.tenant')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 3 - Estimate */}
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('repairs.form.sectionEstimate')}</h4>

          <div className="space-y-2">
            <Label>{t('repairs.form.estimateAmount')}</Label>
            <Input type="number" step="0.01" min="0" value={form.estimate_amount} onChange={e => setForm(f => ({ ...f, estimate_amount: e.target.value }))} placeholder={t('repairs.form.estimatePlaceholder')} />
            {!form.estimate_amount && (
              <p className="text-xs text-muted-foreground">{t('repairs.form.noEstimateHint')}</p>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !isValid}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
