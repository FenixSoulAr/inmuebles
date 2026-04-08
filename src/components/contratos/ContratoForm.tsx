import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import InquilinoForm from '@/components/inquilinos/InquilinoForm'
import { useInquilinos, type GuarantorForm } from '@/hooks/useInquilinos'
import type { ContractEnriched, ServiceForm } from '@/hooks/useContratos'

interface PropertyOption { id: string; full_address: string }
interface TenantOption { id: string; full_name: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: ContractEnriched | null
  existingServices?: ServiceForm[]
  propertyOptions: PropertyOption[]
  tenantOptions: TenantOption[]
  onSave: (data: Record<string, any>, services: ServiceForm[]) => Promise<void>
  onTenantCreated?: () => Promise<void>
}

const emptyService = (): ServiceForm => ({ service_type: 'luz', active: true, due_day: 5, expected_amount: 0 })

const defaultForm = () => ({
  property_id: '',
  tenant_id: '',
  start_date: '',
  end_date: '',
  tipo_contrato: 'vivienda',
  initial_rent: '',
  current_rent: '',
  currency: 'ARS',
  rent_due_day: '5',
  grace_days: '0',
  deposit: '',
  deposit_type: 'monto_fijo',
  deposit_mode: 'required',
  currency_deposit: 'ARS',
  adjustment_type: 'none',
  adjustment_frequency: '12',
  adjustment_base_date: '',
  adjustment_percentage: '',
  interest_rate: '',
  penalty_type: '',
  penalty_value: '',
  expensas_ordinarias: true,
  expensas_extraordinarias: false,
  impuestos_a_cargo_locatario: false,
  seguro_obligatorio: false,
  permite_mascotas: false,
  permite_subalquiler: false,
  // Rural fields
  surface_hectares: '',
  canon_kg_per_ha: '',
  rural_payment_frequency_months: '1',
  rural_canon_unit: 'kg_carne',
  rural_price_per_unit: '',
  rural_canon_notes: '',
})

export default function ContratoForm({ open, onOpenChange, contract, existingServices, propertyOptions, tenantOptions, onSave, onTenantCreated }: Props) {
  const { t } = useTranslation()
  const { crearInquilino } = useInquilinos()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [services, setServices] = useState<ServiceForm[]>([])
  const [showNewTenant, setShowNewTenant] = useState(false)
  const [showMora, setShowMora] = useState(false)

  const isRural = form.tipo_contrato === 'rural'

  useEffect(() => {
    if (contract) {
      setForm({
        property_id: contract.property_id,
        tenant_id: contract.tenant_id,
        start_date: contract.start_date,
        end_date: contract.end_date,
        tipo_contrato: contract.tipo_contrato ?? 'permanente',
        initial_rent: String(contract.initial_rent),
        current_rent: String(contract.current_rent),
        currency: contract.currency ?? 'ARS',
        rent_due_day: String(contract.rent_due_day ?? 5),
        grace_days: String(contract.grace_days ?? 0),
        deposit: String(contract.deposit ?? ''),
        deposit_type: contract.deposit_type ?? 'monto_fijo',
        deposit_mode: contract.deposit_mode ?? 'required',
        currency_deposit: contract.currency_deposit ?? 'ARS',
        adjustment_type: contract.adjustment_type ?? 'none',
        adjustment_frequency: String(contract.adjustment_frequency ?? 12),
        adjustment_base_date: contract.adjustment_base_date ?? '',
        adjustment_percentage: String(contract.adjustment_percentage ?? ''),
        interest_rate: String(contract.interest_rate ?? ''),
        penalty_type: contract.penalty_type ?? '',
        penalty_value: String(contract.penalty_value ?? ''),
        expensas_ordinarias: contract.expensas_ordinarias ?? true,
        expensas_extraordinarias: contract.expensas_extraordinarias ?? false,
        impuestos_a_cargo_locatario: contract.impuestos_a_cargo_locatario ?? false,
        seguro_obligatorio: contract.seguro_obligatorio ?? false,
        permite_mascotas: contract.permite_mascotas ?? false,
        permite_subalquiler: contract.permite_subalquiler ?? false,
        surface_hectares: String((contract as any).surface_hectares ?? ''),
        canon_kg_per_ha: String((contract as any).canon_kg_per_ha ?? ''),
        rural_payment_frequency_months: String((contract as any).rural_payment_frequency_months ?? 1),
        rural_canon_unit: (contract as any).rural_canon_unit ?? 'kg_carne',
        rural_price_per_unit: String((contract as any).rural_price_per_unit ?? ''),
        rural_canon_notes: (contract as any).rural_canon_notes ?? '',
      })
      setServices(existingServices ?? [])
      setShowMora(!!(contract.interest_rate || contract.penalty_type))
    } else {
      setForm(defaultForm())
      setServices([])
      setShowMora(false)
    }
  }, [contract, existingServices, open])

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  // Rural computed values
  const ruralTotalUnitsYear = (Number(form.canon_kg_per_ha) || 0) * (Number(form.surface_hectares) || 0)
  const ruralFreq = Number(form.rural_payment_frequency_months) || 1
  const ruralEstimatedInstallment = ruralTotalUnitsYear > 0 && Number(form.rural_price_per_unit) > 0
    ? (ruralTotalUnitsYear * Number(form.rural_price_per_unit)) / (12 / ruralFreq)
    : 0

  const ruralUnitLabel = (unit: string) => {
    const map: Record<string, string> = {
      kg_carne: 'Kg',
      quintal_grano: t('contracts.rural.unitQuintal', 'Quintales'),
      kg_grano: 'Kg',
      otro: t('contracts.rural.unitOther', 'Unidades'),
    }
    return map[unit] ?? unit
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        property_id: form.property_id,
        tenant_id: form.tenant_id,
        start_date: form.start_date,
        end_date: form.end_date,
        tipo_contrato: form.tipo_contrato,
        initial_rent: Number(form.initial_rent),
        current_rent: Number(form.current_rent),
        currency: form.currency,
        rent_due_day: Number(form.rent_due_day) || 5,
        grace_days: Number(form.grace_days) || 0,
        deposit: form.deposit ? Number(form.deposit) : null,
        deposit_type: form.deposit_type,
        deposit_mode: form.deposit_mode,
        currency_deposit: form.currency_deposit,
        adjustment_type: form.adjustment_type === 'none' ? 'manual' : form.adjustment_type,
        adjustment_frequency: form.adjustment_type !== 'none' ? Number(form.adjustment_frequency) : null,
        adjustment_base_date: form.adjustment_type !== 'none' && form.adjustment_base_date ? form.adjustment_base_date : null,
        adjustment_percentage: form.adjustment_type === 'manual' && form.adjustment_percentage ? Number(form.adjustment_percentage) : null,
        interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
        penalty_type: form.penalty_type || null,
        penalty_value: form.penalty_value ? Number(form.penalty_value) : null,
        expensas_ordinarias: form.expensas_ordinarias,
        expensas_extraordinarias: form.expensas_extraordinarias,
        impuestos_a_cargo_locatario: form.impuestos_a_cargo_locatario,
        seguro_obligatorio: form.seguro_obligatorio,
        permite_mascotas: form.permite_mascotas,
        permite_subalquiler: form.permite_subalquiler,
      }

      // Rural-specific fields
      if (isRural) {
        payload.surface_hectares = form.surface_hectares ? Number(form.surface_hectares) : null
        payload.canon_kg_per_ha = form.canon_kg_per_ha ? Number(form.canon_kg_per_ha) : null
        payload.rural_payment_frequency_months = Number(form.rural_payment_frequency_months) || 1
        payload.rural_canon_unit = form.rural_canon_unit
        payload.rural_price_per_unit = form.rural_price_per_unit ? Number(form.rural_price_per_unit) : null
        payload.rural_canon_notes = form.rural_canon_notes || null
      }

      await onSave(payload, services.filter(s => s.service_type))
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const updateService = (i: number, field: keyof ServiceForm, value: any) => {
    setServices(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const canSave = form.property_id && form.tenant_id && form.start_date && form.end_date && Number(form.initial_rent) > 0 && Number(form.current_rent) > 0

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{contract ? t('contracts.form.editTitle') : t('contracts.form.createTitle')}</SheetTitle>
          <SheetDescription>{contract ? t('contracts.form.editDesc') : t('contracts.form.createDesc')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* SECTION 1: Parties & Term */}
          <Label className="text-base font-semibold">{t('contracts.form.section1')}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('contracts.form.property')} *</Label>
              <Select value={form.property_id} onValueChange={v => set('property_id', v)}>
                <SelectTrigger><SelectValue placeholder={t('contracts.form.selectProperty')} /></SelectTrigger>
                <SelectContent>
                  {propertyOptions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('contracts.form.tenant')} *</Label>
              <Select value={form.tenant_id} onValueChange={v => set('tenant_id', v)}>
                <SelectTrigger><SelectValue placeholder={t('contracts.form.selectTenant')} /></SelectTrigger>
                <SelectContent>
                  {tenantOptions.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                onClick={() => setShowNewTenant(true)}
              >
                <UserPlus className="h-3 w-3" />
                {t('contracts.form.createTenantLink')}
              </button>
            </div>
            <div className="space-y-2">
              <Label>{t('contracts.form.startDate')} *</Label>
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('contracts.form.endDate')} *</Label>
              <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('contracts.form.tipoContrato')}</Label>
              <Select value={form.tipo_contrato} onValueChange={v => set('tipo_contrato', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vivienda">{t('contracts.types.vivienda')}</SelectItem>
                  <SelectItem value="temporada">{t('contracts.types.temporada')}</SelectItem>
                  <SelectItem value="turistico">{t('contracts.types.turistico')}</SelectItem>
                  <SelectItem value="comercial">{t('contracts.types.comercial')}</SelectItem>
                  <SelectItem value="rural">{t('contracts.types.rural')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* SECTION 2: Rent & Deposit */}
          <Label className="text-base font-semibold">{isRural ? t('contracts.rural.sectionTitle') : t('contracts.form.section2')}</Label>

          {isRural ? (
            /* Rural-specific canon section */
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('contracts.rural.paymentFrequency')}</Label>
                <Select value={form.rural_payment_frequency_months} onValueChange={v => set('rural_payment_frequency_months', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('contracts.rural.freqMonthly')}</SelectItem>
                    <SelectItem value="3">{t('contracts.rural.freqQuarterly')}</SelectItem>
                    <SelectItem value="6">{t('contracts.rural.freqSemiannual')}</SelectItem>
                    <SelectItem value="12">{t('contracts.rural.freqAnnual')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.rural.canonUnit')}</Label>
                <Select value={form.rural_canon_unit} onValueChange={v => set('rural_canon_unit', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg_carne">{t('contracts.rural.unitKgCarne')}</SelectItem>
                    <SelectItem value="quintal_grano">{t('contracts.rural.unitQuintalGrano')}</SelectItem>
                    <SelectItem value="kg_grano">{t('contracts.rural.unitKgGrano')}</SelectItem>
                    <SelectItem value="otro">{t('contracts.rural.unitOtro')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.rural.canonPerHa')} ({ruralUnitLabel(form.rural_canon_unit)}/ha)</Label>
                <Input type="number" value={form.canon_kg_per_ha} onChange={e => set('canon_kg_per_ha', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.rural.surfaceHa')}</Label>
                <Input type="number" value={form.surface_hectares} onChange={e => set('surface_hectares', e.target.value)} />
              </div>
              {ruralTotalUnitsYear > 0 && (
                <div className="col-span-2 rounded-md bg-muted p-3 text-sm">
                  <span className="text-muted-foreground">{t('contracts.rural.totalUnitsYear')}:</span>{' '}
                  <span className="font-semibold">{ruralTotalUnitsYear.toLocaleString('es-AR')} {ruralUnitLabel(form.rural_canon_unit)}/{t('contracts.rural.year')}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('contracts.rural.pricePerUnit')} (ARS)</Label>
                <Input type="number" value={form.rural_price_per_unit} onChange={e => set('rural_price_per_unit', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.currency')}</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ruralEstimatedInstallment > 0 && (
                <div className="col-span-2 rounded-md bg-muted p-3 text-sm">
                  <span className="text-muted-foreground">{t('contracts.rural.estimatedInstallment')}:</span>{' '}
                  <span className="font-semibold">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(ruralEstimatedInstallment)}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('contracts.form.initialRent')} *</Label>
                <Input type="number" value={form.initial_rent} onChange={e => set('initial_rent', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.currentRent')} *</Label>
                <Input type="number" value={form.current_rent} onChange={e => set('current_rent', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.rentDueDay')}</Label>
                <Input type="number" min={1} max={31} value={form.rent_due_day} onChange={e => set('rent_due_day', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.graceDays')}</Label>
                <Input type="number" value={form.grace_days} onChange={e => set('grace_days', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.deposit')}</Label>
                <Input type="number" value={form.deposit} onChange={e => set('deposit', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.depositMode')}</Label>
                <Select value={form.deposit_mode} onValueChange={v => set('deposit_mode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">{t('contracts.depositModes.required')}</SelectItem>
                    <SelectItem value="optional">{t('contracts.depositModes.optional')}</SelectItem>
                    <SelectItem value="none">{t('contracts.depositModes.none')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>{t('contracts.rural.canonNotes')}</Label>
                <Textarea
                  value={form.rural_canon_notes}
                  onChange={e => set('rural_canon_notes', e.target.value)}
                  placeholder={t('contracts.rural.canonNotesPlaceholder')}
                  rows={3}
                />
              </div>
            </div>
          ) : (
            /* Standard rent & deposit section */
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('contracts.form.initialRent')} *</Label>
                <Input type="number" value={form.initial_rent} onChange={e => set('initial_rent', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.currentRent')} *</Label>
                <Input type="number" value={form.current_rent} onChange={e => set('current_rent', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.currency')}</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.rentDueDay')}</Label>
                <Input type="number" min={1} max={31} value={form.rent_due_day} onChange={e => set('rent_due_day', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.graceDays')}</Label>
                <Input type="number" value={form.grace_days} onChange={e => set('grace_days', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.deposit')}</Label>
                <Input type="number" value={form.deposit} onChange={e => set('deposit', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.depositType')}</Label>
                <Select value={form.deposit_type} onValueChange={v => set('deposit_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monto_fijo">{t('contracts.depositTypes.fixed')}</SelectItem>
                    <SelectItem value="meses">{t('contracts.depositTypes.months')}</SelectItem>
                    <SelectItem value="cash">{t('contracts.depositTypes.cash')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.depositMode')}</Label>
                <Select value={form.deposit_mode} onValueChange={v => set('deposit_mode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">{t('contracts.depositModes.required')}</SelectItem>
                    <SelectItem value="optional">{t('contracts.depositModes.optional')}</SelectItem>
                    <SelectItem value="none">{t('contracts.depositModes.none')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.currencyDeposit')}</Label>
                <Select value={form.currency_deposit} onValueChange={v => set('currency_deposit', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Separator />

          {/* SECTION 3: Adjustment */}
          <Label className="text-base font-semibold">{t('contracts.form.section3')}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('contracts.form.adjustmentType')}</Label>
              <Select value={form.adjustment_type} onValueChange={v => set('adjustment_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('contracts.adjustmentTypes.none')}</SelectItem>
                  <SelectItem value="ipc">IPC</SelectItem>
                  <SelectItem value="icl">ICL</SelectItem>
                  <SelectItem value="manual">{t('contracts.adjustmentTypes.manual')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.adjustment_type !== 'none' && (
              <>
                <div className="space-y-2">
                  <Label>{t('contracts.form.adjustmentFrequency')}</Label>
                  <Input type="number" value={form.adjustment_frequency} onChange={e => set('adjustment_frequency', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('contracts.form.adjustmentBaseDate')}</Label>
                  <Input type="date" value={form.adjustment_base_date} onChange={e => set('adjustment_base_date', e.target.value)} />
                </div>
                {form.adjustment_type === 'manual' && (
                  <div className="space-y-2">
                    <Label>{t('contracts.form.adjustmentPercentage')}</Label>
                    <Input type="number" value={form.adjustment_percentage} onChange={e => set('adjustment_percentage', e.target.value)} placeholder="%" />
                  </div>
                )}
              </>
            )}
          </div>

          <Separator />

          {/* SECTION 4: Late fees */}
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{t('contracts.form.section4')}</Label>
            <Button variant="ghost" size="sm" onClick={() => setShowMora(!showMora)}>
              {showMora ? t('contracts.form.collapse') : t('contracts.form.expand')}
            </Button>
          </div>
          {showMora && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('contracts.form.interestRate')}</Label>
                <Input type="number" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} placeholder="%" />
              </div>
              <div className="space-y-2">
                <Label>{t('contracts.form.penaltyType')}</Label>
                <Select value={form.penalty_type} onValueChange={v => set('penalty_type', v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{t('contracts.penaltyTypes.percentage')}</SelectItem>
                    <SelectItem value="fixed">{t('contracts.penaltyTypes.fixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.penalty_type && (
                <div className="space-y-2">
                  <Label>{t('contracts.form.penaltyValue')}</Label>
                  <Input type="number" value={form.penalty_value} onChange={e => set('penalty_value', e.target.value)} />
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* SECTION 5: Clauses */}
          <Label className="text-base font-semibold">{t('contracts.form.section5')}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['expensas_ordinarias', 'expensas_extraordinarias', 'impuestos_a_cargo_locatario', 'seguro_obligatorio', 'permite_mascotas', 'permite_subalquiler'] as const).map(field => (
              <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[field]}
                  onChange={e => set(field, e.target.checked)}
                  className="rounded border-input"
                />
                {t(`contracts.clauses.${field}`)}
              </label>
            ))}
          </div>

          <Separator />

          {/* SECTION 6: Services */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{t('contracts.form.section6')}</Label>
              <Button variant="outline" size="sm" onClick={() => setServices(prev => [...prev, emptyService()])}>
                <Plus className="h-3 w-3 mr-1" />{t('contracts.form.addService')}
              </Button>
            </div>
            {services.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('contracts.form.noServices')}</p>
            )}
            {services.map((s, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-end rounded-md border p-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('contracts.form.serviceType')}</Label>
                  <Select value={s.service_type} onValueChange={v => updateService(i, 'service_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['luz', 'gas', 'agua', 'expensas', 'internet', 'seguro'].map(st => (
                        <SelectItem key={st} value={st}>{t(`contracts.serviceTypes.${st}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('contracts.form.dueDay')}</Label>
                  <Input type="number" min={1} max={31} value={s.due_day} onChange={e => updateService(i, 'due_day', Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('contracts.form.expectedAmount')}</Label>
                  <Input type="number" value={s.expected_amount} onChange={e => updateService(i, 'expected_amount', Number(e.target.value))} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setServices(prev => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !canSave}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    {/* Inline tenant creation */}
    <InquilinoForm
      open={showNewTenant}
      onOpenChange={setShowNewTenant}
      onSave={async (data, guarantors) => {
        const newId = await crearInquilino(data, guarantors as GuarantorForm[])
        toast.success(t('tenants.toast.created'))
        await onTenantCreated?.()
        set('tenant_id', newId)
      }}
    />
    </>
  )
}
