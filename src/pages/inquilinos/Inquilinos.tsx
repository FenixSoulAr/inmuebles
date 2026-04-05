import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Users, Search, Pencil, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { useInquilinos, type TenantWithProperty, type GuarantorForm } from '@/hooks/useInquilinos'
import InquilinoForm from '@/components/inquilinos/InquilinoForm'
import InquilinoDetail from '@/components/inquilinos/InquilinoDetail'

export default function Inquilinos() {
  const { t } = useTranslation()
  const { inquilinos, loading, crearInquilino, editarInquilino, eliminarInquilino, fetchGuarantors, fetchContracts, hasAnyContract } = useInquilinos()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<TenantWithProperty | null>(null)
  const [detailTenant, setDetailTenant] = useState<TenantWithProperty | null>(null)
  const [existingGuarantors, setExistingGuarantors] = useState<GuarantorForm[]>([])
  const [deleteTarget, setDeleteTarget] = useState<TenantWithProperty | null>(null)
  const [deleteBlocked, setDeleteBlocked] = useState(false)

  const filtered = inquilinos.filter(t => {
    const matchesSearch =
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (t.doc_id ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const openCreate = () => {
    setEditingTenant(null)
    setExistingGuarantors([])
    setFormOpen(true)
  }

  const openEdit = async (tenant: TenantWithProperty) => {
    const gs = await fetchGuarantors(tenant.id)
    setEditingTenant(tenant)
    setExistingGuarantors(gs.map(g => ({ id: g.id, full_name: g.full_name, contact_info: g.contact_info ?? '', notes: g.notes ?? '' })))
    setFormOpen(true)
  }

  const openDetail = (tenant: TenantWithProperty) => {
    setDetailTenant(tenant)
    setDetailOpen(true)
  }

  const handleSave = async (data: any, guarantors: GuarantorForm[]) => {
    if (editingTenant) {
      await editarInquilino(editingTenant.id, data, guarantors)
      toast.success(t('tenants.toast.updated'))
    } else {
      await crearInquilino(data, guarantors)
      toast.success(t('tenants.toast.created'))
    }
  }

  const confirmDelete = async (tenant: TenantWithProperty) => {
    const active = await hasActiveContract(tenant.id)
    setDeleteBlocked(active)
    setDeleteTarget(tenant)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await eliminarInquilino(deleteTarget.id)
      toast.success(t('tenants.toast.deleted'))
      setDetailOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? t('tenants.toast.deleteError'))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('tenants.title')}</h2>
          <p className="text-muted-foreground">{t('tenants.subtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('tenants.new')}</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('tenants.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">{t('tenants.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('tenants.emptyDesc')}</p>
            <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('tenants.add')}</Button>
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
                    <TableHead>{t('tenants.columns.name')}</TableHead>
                    <TableHead>{t('tenants.columns.docId')}</TableHead>
                    <TableHead>{t('tenants.columns.phone')}</TableHead>
                    <TableHead>{t('tenants.columns.status')}</TableHead>
                    <TableHead>{t('tenants.columns.property')}</TableHead>
                    <TableHead className="text-right">{t('tenants.columns.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(tenant => (
                    <TableRow key={tenant.id} className="cursor-pointer" onClick={() => openDetail(tenant)}>
                      <TableCell className="font-medium">{tenant.full_name}</TableCell>
                      <TableCell>{tenant.doc_id ?? '—'}</TableCell>
                      <TableCell>{tenant.phone ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={tenant.status === 'active' ? 'success' : 'secondary'}>
                          {t(`status.${tenant.status}`, tenant.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{tenant.current_property ?? '—'}</TableCell>
                      <TableCell className="text-right space-x-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openDetail(tenant)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(tenant)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDelete(tenant)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-4 md:hidden">
            {filtered.map(tenant => (
              <Card key={tenant.id} className="cursor-pointer" onClick={() => openDetail(tenant)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{tenant.full_name}</p>
                      {tenant.doc_id && <p className="text-xs text-muted-foreground">DNI: {tenant.doc_id}</p>}
                    </div>
                    <Badge variant={tenant.status === 'active' ? 'success' : 'secondary'}>
                      {t(`status.${tenant.status}`, tenant.status)}
                    </Badge>
                  </div>
                  {tenant.current_property && <p className="text-sm text-muted-foreground truncate">{tenant.current_property}</p>}
                  <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(tenant)}><Pencil className="h-3 w-3 mr-1" />{t('tenants.editBtn')}</Button>
                    <Button variant="outline" size="sm" onClick={() => confirmDelete(tenant)}><Trash2 className="h-3 w-3 mr-1 text-destructive" />{t('tenants.deleteBtn')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Form Sheet */}
      <InquilinoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        tenant={editingTenant}
        existingGuarantors={existingGuarantors}
        onSave={handleSave}
      />

      {/* Detail Sheet */}
      <InquilinoDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        tenant={detailTenant}
        onEdit={() => { setDetailOpen(false); if (detailTenant) openEdit(detailTenant) }}
        onDelete={() => { if (detailTenant) confirmDelete(detailTenant) }}
        fetchGuarantors={fetchGuarantors}
        fetchContracts={fetchContracts}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteBlocked ? t('tenants.delete.blockedTitle') : t('tenants.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocked
                ? t('tenants.delete.blockedDesc', { name: deleteTarget?.full_name })
                : <span dangerouslySetInnerHTML={{ __html: t('tenants.delete.desc', { name: deleteTarget?.full_name }) }} />
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{deleteBlocked ? t('common.cancel') : t('tenants.delete.cancel')}</AlertDialogCancel>
            {!deleteBlocked && (
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t('tenants.delete.confirm')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
