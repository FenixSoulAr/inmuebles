import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, FileText, Search, Pencil, Eye, Power } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { useContratos, type ContractEnriched, type ServiceForm } from '@/hooks/useContratos'
import { formatDate, formatCurrency } from '@/lib/utils'
import ContratoForm from '@/components/contratos/ContratoForm'
import ContratoDetail from '@/components/contratos/ContratoDetail'

export default function Contratos() {
  const { t } = useTranslation()
  const { contratos, loading, crearContrato, editarContrato, toggleActivo, fetchServices, fetchAdjustments, fetchPropertyOptions, fetchTenantOptions } = useContratos()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<ContractEnriched | null>(null)
  const [detailContract, setDetailContract] = useState<ContractEnriched | null>(null)
  const [existingServices, setExistingServices] = useState<ServiceForm[]>([])
  const [propertyOptions, setPropertyOptions] = useState<{ id: string; full_address: string }[]>([])
  const [tenantOptions, setTenantOptions] = useState<{ id: string; full_name: string }[]>([])
  const [toggleTarget, setToggleTarget] = useState<ContractEnriched | null>(null)

  // Load options when form opens
  const loadOptions = async () => {
    const [props, tenants] = await Promise.all([fetchPropertyOptions(), fetchTenantOptions()])
    setPropertyOptions(props)
    setTenantOptions(tenants)
  }

  const filtered = contratos.filter(c => {
    const matchesSearch =
      c.property_address.toLowerCase().includes(search.toLowerCase()) ||
      c.tenant_name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.is_active : !c.is_active)
    return matchesSearch && matchesStatus
  })

  const openCreate = async () => {
    setEditingContract(null)
    setExistingServices([])
    await loadOptions()
    setFormOpen(true)
  }

  const openEdit = async (contract: ContractEnriched) => {
    await loadOptions()
    const svcs = await fetchServices(contract.id)
    setEditingContract(contract)
    setExistingServices(svcs.map(s => ({ id: s.id, service_type: s.service_type, active: s.active, due_day: s.due_day ?? 5, expected_amount: s.expected_amount ?? 0 })))
    setFormOpen(true)
  }

  const openDetail = (contract: ContractEnriched) => {
    setDetailContract(contract)
    setDetailOpen(true)
  }

  const handleSave = async (data: Record<string, any>, services: ServiceForm[]) => {
    try {
      if (editingContract) {
        await editarContrato(editingContract.id, data, services)
        toast.success(t('contracts.toast.updated'))
      } else {
        await crearContrato(data, services)
        toast.success(t('contracts.toast.created'))
      }
    } catch (e: any) {
      toast.error(e.message ?? t('contracts.toast.saveError'))
    }
  }

  const confirmToggle = (contract: ContractEnriched) => setToggleTarget(contract)

  const handleToggle = async () => {
    if (!toggleTarget) return
    try {
      await toggleActivo(toggleTarget.id, toggleTarget.is_active)
      toast.success(toggleTarget.is_active ? t('contracts.toast.deactivated') : t('contracts.toast.activated'))
      setDetailOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? t('contracts.toast.toggleError'))
    } finally {
      setToggleTarget(null)
    }
  }

  const adjBadge = (type: string) => {
    const map: Record<string, string> = { ipc: 'IPC', icl: 'ICL', manual: t('contracts.adjustmentTypes.manual') }
    return map[type] ?? t('contracts.adjustmentTypes.none')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('contracts.title')}</h2>
          <p className="text-muted-foreground">{t('contracts.subtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('contracts.new')}</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('contracts.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tenants.filterAll')}</SelectItem>
            <SelectItem value="active">{t('tenants.filterActive')}</SelectItem>
            <SelectItem value="inactive">{t('tenants.filterInactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">{t('contracts.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('contracts.emptyDesc')}</p>
            <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('contracts.add')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('contracts.columns.property')}</TableHead>
                    <TableHead>{t('contracts.columns.tenant')}</TableHead>
                    <TableHead>{t('contracts.columns.period')}</TableHead>
                    <TableHead>{t('contracts.columns.rent')}</TableHead>
                    <TableHead>{t('contracts.columns.adjustment')}</TableHead>
                    <TableHead>{t('contracts.columns.status')}</TableHead>
                    <TableHead className="text-right">{t('tenants.columns.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(contract => (
                    <TableRow key={contract.id} className="cursor-pointer" onClick={() => openDetail(contract)}>
                      <TableCell className="font-medium max-w-[180px] truncate">{contract.property_address}</TableCell>
                      <TableCell>{contract.tenant_name}</TableCell>
                      <TableCell className="text-xs">{formatDate(contract.start_date)} → {formatDate(contract.end_date)}</TableCell>
                      <TableCell>{formatCurrency(contract.current_rent, contract.currency ?? 'ARS')}</TableCell>
                      <TableCell><Badge variant="outline">{adjBadge(contract.adjustment_type)}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={contract.is_active ? 'success' : 'secondary'}>
                          {contract.is_active ? t('status.active') : t('status.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openDetail(contract)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(contract)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmToggle(contract)}><Power className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-4 md:hidden">
            {filtered.map(contract => (
              <Card key={contract.id} className="cursor-pointer" onClick={() => openDetail(contract)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{contract.property_address}</p>
                      <p className="text-xs text-muted-foreground">{contract.tenant_name}</p>
                    </div>
                    <Badge variant={contract.is_active ? 'success' : 'secondary'}>
                      {contract.is_active ? t('status.active') : t('status.inactive')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(contract.start_date)} → {formatDate(contract.end_date)}</p>
                  <p className="text-sm font-medium">{formatCurrency(contract.current_rent, contract.currency ?? 'ARS')}</p>
                  <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(contract)}><Pencil className="h-3 w-3 mr-1" />{t('tenants.editBtn')}</Button>
                    <Button variant="outline" size="sm" onClick={() => confirmToggle(contract)}><Power className="h-3 w-3 mr-1" />{contract.is_active ? t('contracts.deactivate') : t('contracts.activate')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Form Sheet */}
      <ContratoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contract={editingContract}
        existingServices={existingServices}
        propertyOptions={propertyOptions}
        tenantOptions={tenantOptions}
        onSave={handleSave}
      />

      {/* Detail Sheet */}
      <ContratoDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contract={detailContract}
        onEdit={() => { setDetailOpen(false); if (detailContract) openEdit(detailContract) }}
        onToggleActive={() => { if (detailContract) confirmToggle(detailContract) }}
        fetchServices={fetchServices}
        fetchAdjustments={fetchAdjustments}
      />

      {/* Toggle confirmation */}
      <AlertDialog open={!!toggleTarget} onOpenChange={open => !open && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.is_active ? t('contracts.toggle.deactivateTitle') : t('contracts.toggle.activateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active ? t('contracts.toggle.deactivateDesc') : t('contracts.toggle.activateDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}>
              {toggleTarget?.is_active ? t('contracts.deactivate') : t('contracts.activate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
