import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import type { TenantWithProperty, GuarantorForm } from '@/hooks/useInquilinos'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant?: TenantWithProperty | null
  existingGuarantors?: GuarantorForm[]
  onSave: (data: {
    full_name: string
    doc_id: string
    email: string
    phone: string
    status: string
    preferred_language: string
  }, guarantors: GuarantorForm[]) => Promise<void>
}

const emptyGuarantor = (): GuarantorForm => ({ full_name: '', contact_info: '', notes: '' })

export default function InquilinoForm({ open, onOpenChange, tenant, existingGuarantors, onSave }: Props) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    doc_id: '',
    email: '',
    phone: '',
    status: 'active',
    preferred_language: 'es',
  })
  const [guarantors, setGuarantors] = useState<GuarantorForm[]>([])

  useEffect(() => {
    if (tenant) {
      setForm({
        full_name: tenant.full_name,
        doc_id: tenant.doc_id ?? '',
        email: tenant.email ?? '',
        phone: tenant.phone ?? '',
        status: tenant.status,
        preferred_language: tenant.preferred_language,
      })
      setGuarantors(existingGuarantors ?? [])
    } else {
      setForm({ full_name: '', doc_id: '', email: '', phone: '', status: 'active', preferred_language: 'es' })
      setGuarantors([])
    }
  }, [tenant, existingGuarantors, open])

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await onSave(form, guarantors.filter(g => g.full_name.trim()))
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const updateGuarantor = (i: number, field: keyof GuarantorForm, value: string) => {
    setGuarantors(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{tenant ? t('tenants.form.editTitle') : t('tenants.form.createTitle')}</SheetTitle>
          <SheetDescription>{tenant ? t('tenants.form.editDesc') : t('tenants.form.createDesc')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('tenants.form.fullName')} *</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t('tenants.form.docId')} *</Label>
            <Input value={form.doc_id} onChange={e => setForm(f => ({ ...f, doc_id: e.target.value }))} placeholder="12.345.678" />
          </div>
          <div className="space-y-2">
            <Label>{t('tenants.form.email')}</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t('tenants.form.phone')}</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t('tenants.form.status')}</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('tenants.form.language')}</Label>
            <Select value={form.preferred_language} onValueChange={v => setForm(f => ({ ...f, preferred_language: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{t('tenants.form.guarantorsTitle')}</Label>
              <Button variant="outline" size="sm" onClick={() => setGuarantors(prev => [...prev, emptyGuarantor()])}>
                <Plus className="h-3 w-3 mr-1" />{t('tenants.form.addGuarantor')}
              </Button>
            </div>
            {guarantors.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('tenants.form.noGuarantors')}</p>
            )}
            {guarantors.map((g, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('tenants.form.guarantor')} #{i + 1}</span>
                  <Button variant="ghost" size="icon" onClick={() => setGuarantors(prev => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <Input placeholder={t('tenants.form.guarantorName')} value={g.full_name} onChange={e => updateGuarantor(i, 'full_name', e.target.value)} />
                <Input placeholder={t('tenants.form.guarantorContact')} value={g.contact_info} onChange={e => updateGuarantor(i, 'contact_info', e.target.value)} />
                <Input placeholder={t('tenants.form.guarantorNotes')} value={g.notes} onChange={e => updateGuarantor(i, 'notes', e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.full_name.trim() || !form.doc_id.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
