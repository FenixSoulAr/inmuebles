import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { TenantWithProperty, Guarantor } from '@/hooks/useInquilinos'

interface ContractRow {
  id: string
  property_address: string
  start_date: string
  end_date: string
  current_rent: number
  currency: string | null
  is_active: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: TenantWithProperty | null
  onEdit: () => void
  onDelete: () => void
  fetchGuarantors: (tenantId: string) => Promise<Guarantor[]>
  fetchContracts: (tenantId: string) => Promise<ContractRow[]>
}

export default function InquilinoDetail({ open, onOpenChange, tenant, onEdit, onDelete, fetchGuarantors, fetchContracts }: Props) {
  const { t } = useTranslation()
  const [guarantors, setGuarantors] = useState<Guarantor[]>([])
  const [contracts, setContracts] = useState<ContractRow[]>([])

  useEffect(() => {
    if (open && tenant) {
      fetchGuarantors(tenant.id).then(setGuarantors)
      fetchContracts(tenant.id).then(setContracts)
    } else {
      setGuarantors([])
      setContracts([])
    }
  }, [open, tenant])

  if (!tenant) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{tenant.full_name}</SheetTitle>
          <SheetDescription>
            <Badge variant={tenant.status === 'active' ? 'success' : 'secondary'}>
              {t(`status.${tenant.status}`, tenant.status)}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">{t('tenants.form.docId')}:</span> <span className="font-medium">{tenant.doc_id ?? '—'}</span></div>
            <div><span className="text-muted-foreground">{t('tenants.form.email')}:</span> <span className="font-medium">{tenant.email ?? '—'}</span></div>
            <div><span className="text-muted-foreground">{t('tenants.form.phone')}:</span> <span className="font-medium">{tenant.phone ?? '—'}</span></div>
            <div><span className="text-muted-foreground">{t('tenants.form.language')}:</span> <span className="font-medium">{tenant.preferred_language === 'es' ? 'Español' : 'English'}</span></div>
          </div>

          <Separator />

          {/* Guarantors */}
          <div>
            <h4 className="font-semibold mb-2">{t('tenants.detail.guarantors')}</h4>
            {guarantors.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('tenants.detail.noGuarantors')}</p>
            ) : (
              <div className="space-y-2">
                {guarantors.map(g => (
                  <div key={g.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{g.full_name}</p>
                    {g.contact_info && <p className="text-muted-foreground">{g.contact_info}</p>}
                    {g.notes && <p className="text-muted-foreground italic">{g.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Contract history */}
          <div>
            <h4 className="font-semibold mb-2">{t('tenants.detail.contractHistory')}</h4>
            {contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('tenants.detail.noContracts')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('tenants.detail.property')}</TableHead>
                    <TableHead>{t('tenants.detail.period')}</TableHead>
                    <TableHead>{t('tenants.detail.rent')}</TableHead>
                    <TableHead>{t('tenants.detail.contractStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.property_address}</TableCell>
                      <TableCell className="text-xs">{formatDate(c.start_date)} → {formatDate(c.end_date)}</TableCell>
                      <TableCell className="text-xs">{formatCurrency(c.current_rent, c.currency ?? 'ARS')}</TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? 'success' : 'secondary'}>
                          {c.is_active ? t('tenants.detail.activeContract') : t('tenants.detail.finishedContract')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-1" />{t('tenants.editBtn')}</Button>
          <Button variant="outline" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1 text-destructive" />{t('tenants.deleteBtn')}</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
