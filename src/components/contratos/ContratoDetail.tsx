import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Power, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { ContractEnriched, ContractService, ContractAdjustment } from '@/hooks/useContratos'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: ContractEnriched | null
  onEdit: () => void
  onToggleActive: () => void
  fetchServices: (contractId: string) => Promise<ContractService[]>
  fetchAdjustments: (contractId: string) => Promise<ContractAdjustment[]>
}

export default function ContratoDetail({ open, onOpenChange, contract, onEdit, onToggleActive, fetchServices, fetchAdjustments }: Props) {
  const { t } = useTranslation()
  const [services, setServices] = useState<ContractService[]>([])
  const [adjustments, setAdjustments] = useState<ContractAdjustment[]>([])

  useEffect(() => {
    if (open && contract) {
      fetchServices(contract.id).then(setServices)
      fetchAdjustments(contract.id).then(setAdjustments)
    } else {
      setServices([])
      setAdjustments([])
    }
  }, [open, contract])

  if (!contract) return null

  const adjLabel = (type: string) => {
    const map: Record<string, string> = { ipc: 'IPC', icl: 'ICL', manual: t('contracts.adjustmentTypes.manual'), none: t('contracts.adjustmentTypes.none') }
    return map[type] ?? type
  }

  const copyLink = () => {
    if (contract.public_submission_token) {
      navigator.clipboard.writeText(`${window.location.origin}/submit/${contract.public_submission_token}`)
      toast.success(t('contracts.detail.linkCopied'))
    }
  }

  const clauseKeys = ['expensas_ordinarias', 'expensas_extraordinarias', 'impuestos_a_cargo_locatario', 'seguro_obligatorio', 'permite_mascotas', 'permite_subalquiler'] as const
  const activeClauses = clauseKeys.filter(k => (contract as any)[k])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{contract.property_address}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span>{contract.tenant_name}</span>
            <Badge variant={contract.is_active ? 'success' : 'secondary'}>
              {contract.is_active ? t('status.active') : t('status.inactive')}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">{t('contracts.detail.period')}:</span> <span className="font-medium">{formatDate(contract.start_date)} → {formatDate(contract.end_date)}</span></div>
            <div><span className="text-muted-foreground">{t('contracts.detail.type')}:</span> <span className="font-medium">{t(`contracts.types.${contract.tipo_contrato ?? 'permanente'}`)}</span></div>
            <div><span className="text-muted-foreground">{t('contracts.form.initialRent')}:</span> <span className="font-medium">{formatCurrency(contract.initial_rent, contract.currency ?? 'ARS')}</span></div>
            <div><span className="text-muted-foreground">{t('contracts.form.currentRent')}:</span> <span className="font-medium">{formatCurrency(contract.current_rent, contract.currency ?? 'ARS')}</span></div>
            <div><span className="text-muted-foreground">{t('contracts.form.rentDueDay')}:</span> <span className="font-medium">{contract.rent_due_day ?? 5}</span></div>
            <div><span className="text-muted-foreground">{t('contracts.form.graceDays')}:</span> <span className="font-medium">{contract.grace_days ?? 0}</span></div>
          </div>

          {/* Rural canon summary */}
          {contract.tipo_contrato === 'rural' && (contract as any).surface_hectares && (contract as any).canon_kg_per_ha && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <h4 className="font-semibold flex items-center gap-1">🌾 {t('contracts.rural.summaryTitle')}</h4>
              {(() => {
                const c = contract as any
                const unitLabel: Record<string, string> = {
                  kg_carne: 'Kg',
                  quintal_grano: t('contracts.rural.unitQuintal', 'Quintales'),
                  kg_grano: 'Kg',
                  otro: t('contracts.rural.unitOther', 'Unidades'),
                }
                const unit = unitLabel[c.rural_canon_unit] ?? 'Kg'
                const total = c.canon_kg_per_ha * c.surface_hectares
                const freqMap: Record<number, string> = { 1: t('contracts.rural.freqMonthly'), 3: t('contracts.rural.freqQuarterly'), 6: t('contracts.rural.freqSemiannual'), 12: t('contracts.rural.freqAnnual') }
                const freq = freqMap[c.rural_payment_frequency_months] ?? `${c.rural_payment_frequency_months} meses`
                return (
                  <p>
                    {c.canon_kg_per_ha} {unit}/ha × {c.surface_hectares} ha = <strong>{total.toLocaleString('es-AR')} {unit}/{t('contracts.rural.year')}</strong> — {t('contracts.rural.frequencyLabel')}: {freq}
                  </p>
                )
              })()}
              {(contract as any).rural_price_per_unit && (
                <p className="text-muted-foreground">
                  {t('contracts.rural.pricePerUnit')}: {formatCurrency((contract as any).rural_price_per_unit, 'ARS')}
                </p>
              )}
              {(contract as any).rural_canon_notes && (
                <p className="text-muted-foreground italic">{(contract as any).rural_canon_notes}</p>
              )}
            </div>
          )}

          {/* Adjustment */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">{t('contracts.form.adjustmentType')}:</span> <span className="font-medium">{adjLabel(contract.adjustment_type)}</span></div>
            {contract.adjustment_frequency && <div><span className="text-muted-foreground">{t('contracts.form.adjustmentFrequency')}:</span> <span className="font-medium">{contract.adjustment_frequency} {t('contracts.detail.months')}</span></div>}
            {contract.next_adjustment_date && <div><span className="text-muted-foreground">{t('contracts.detail.nextAdjustment')}:</span> <span className="font-medium">{formatDate(contract.next_adjustment_date)}</span></div>}
          </div>

          <Separator />

          {/* Active clauses */}
          {activeClauses.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">{t('contracts.detail.clauses')}</h4>
              <div className="flex flex-wrap gap-2">
                {activeClauses.map(k => (
                  <Badge key={k} variant="outline">{t(`contracts.clauses.${k}`)}</Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Services */}
          <div>
            <h4 className="font-semibold mb-2">{t('contracts.detail.services')}</h4>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('contracts.form.noServices')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('contracts.form.serviceType')}</TableHead>
                    <TableHead>{t('contracts.form.expectedAmount')}</TableHead>
                    <TableHead>{t('contracts.form.dueDay')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{t(`contracts.serviceTypes.${s.service_type}`)}</TableCell>
                      <TableCell className="text-xs">{s.expected_amount ? formatCurrency(s.expected_amount, contract.currency ?? 'ARS') : '—'}</TableCell>
                      <TableCell className="text-xs">{s.due_day ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <Separator />

          {/* Adjustment history */}
          <div>
            <h4 className="font-semibold mb-2">{t('contracts.detail.adjustmentHistory')}</h4>
            {adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('contracts.detail.noAdjustments')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('contracts.detail.adjDate')}</TableHead>
                    <TableHead>{t('contracts.detail.adjPrevious')}</TableHead>
                    <TableHead>{t('contracts.detail.adjCalculated')}</TableHead>
                    <TableHead>{t('contracts.detail.adjConfirmed')}</TableHead>
                    <TableHead>{t('contracts.detail.adjStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{formatDate(a.adjustment_date)}</TableCell>
                      <TableCell className="text-xs">{formatCurrency(a.previous_amount, contract.currency ?? 'ARS')}</TableCell>
                      <TableCell className="text-xs">{formatCurrency(a.calculated_amount, contract.currency ?? 'ARS')}</TableCell>
                      <TableCell className="text-xs">{a.confirmed_amount ? formatCurrency(a.confirmed_amount, contract.currency ?? 'ARS') : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === 'confirmed' ? 'success' : 'secondary'}>
                          {t(`contracts.detail.adjStatuses.${a.status}`, a.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Public token */}
          {contract.public_submission_token && contract.token_status === 'active' && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">{t('contracts.detail.publicLink')}</h4>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="h-3 w-3 mr-1" />{t('contracts.detail.copyLink')}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-1" />{t('tenants.editBtn')}</Button>
          <Button variant="outline" onClick={onToggleActive}>
            <Power className="h-4 w-4 mr-1" />
            {contract.is_active ? t('contracts.deactivate') : t('contracts.activate')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
