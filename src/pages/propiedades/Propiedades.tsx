import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Building2, Search, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { usePropiedades, type Propiedad, type PropiedadInsert } from '@/hooks/usePropiedades'

const TYPE_OPTIONS = ['apartment', 'house', 'ph', 'local', 'office', 'warehouse'] as const
const STATUS_OPTIONS = ['occupied', 'vacant'] as const

const emptyForm = { full_address: '', internal_identifier: '', type: 'apartment', status: 'vacant' }

function getDisplayStatus(p: Propiedad): string {
  if (!p.active) return 'inactive'
  if (p.status === 'occupied') return 'occupied'
  if (p.status === 'vacant') return 'vacant'
  return 'unknown'
}

const displayStatusVariant: Record<string, 'success' | 'default' | 'warning' | 'secondary'> = {
  occupied: 'success',
  vacant: 'default',
  maintenance: 'warning',
  inactive: 'secondary',
  unknown: 'secondary',
}

export default function Propiedades() {
  const { t } = useTranslation()
  const { propiedades, loading, crearPropiedad, editarPropiedad, eliminarPropiedad } = usePropiedades()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Propiedad | null>(null)

  const filtered = propiedades.filter(p =>
    p.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
    p.full_address.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (p: Propiedad) => {
    setEditingId(p.id)
    setForm({ full_address: p.full_address, internal_identifier: p.internal_identifier, type: p.type, status: p.status })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.full_address.trim() || !form.internal_identifier.trim()) {
      toast.error(t('properties.toast.requiredFields'))
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await editarPropiedad(editingId, form)
        toast.success(t('properties.toast.updated'))
      } else {
        await crearPropiedad(form as PropiedadInsert)
        toast.success(t('properties.toast.created'))
      }
      setDialogOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? t('properties.toast.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await eliminarPropiedad(deleteTarget.id)
      toast.success(t('properties.toast.deleted'))
    } catch (e: any) {
      toast.error(e.message ?? t('properties.toast.deleteError'))
    } finally {
      setDeleteTarget(null)
    }
  }

  const StatusBadge = ({ property }: { property: Propiedad }) => {
    const ds = getDisplayStatus(property)
    return <Badge variant={displayStatusVariant[ds] ?? 'secondary'}>{t(`status.${ds}`, ds)}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('properties.title')}</h2>
          <p className="text-muted-foreground">{t('properties.subtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('properties.new')}</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('properties.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">{t('properties.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('properties.emptyDesc')}</p>
            <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('properties.add')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('properties.columns.address')}</TableHead>
                    <TableHead>{t('properties.columns.identifier')}</TableHead>
                    <TableHead>{t('properties.columns.type')}</TableHead>
                    <TableHead>{t('properties.columns.status')}</TableHead>
                    <TableHead className="text-right">{t('properties.columns.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_address}</TableCell>
                      <TableCell>{p.internal_identifier}</TableCell>
                      <TableCell>{t(`propertyType.${p.type}`, p.type)}</TableCell>
                      <TableCell><StatusBadge property={p} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="grid gap-4 md:hidden">
            {filtered.map(p => (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{p.internal_identifier}</p>
                      <p className="text-xs text-muted-foreground">{t(`propertyType.${p.type}`, p.type)}</p>
                    </div>
                    <StatusBadge property={p} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{p.full_address}</p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3 w-3 mr-1" />{t('properties.editBtn')}</Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteTarget(p)}><Trash2 className="h-3 w-3 mr-1 text-destructive" />{t('properties.deleteBtn')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t('properties.form.editTitle') : t('properties.form.createTitle')}</DialogTitle>
            <DialogDescription>
              {editingId ? t('properties.form.editDesc') : t('properties.form.createDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_address">{t('properties.form.addressLabel')}</Label>
              <Input id="full_address" value={form.full_address} onChange={e => setForm(f => ({ ...f, full_address: e.target.value }))} placeholder={t('properties.form.addressPlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_identifier">{t('properties.form.identifierLabel')}</Label>
              <Input id="internal_identifier" value={form.internal_identifier} onChange={e => setForm(f => ({ ...f, internal_identifier: e.target.value }))} placeholder={t('properties.form.identifierPlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('properties.form.typeLabel')}</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(v => <SelectItem key={v} value={v}>{t(`propertyType.${v}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('properties.form.statusLabel')}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(v => <SelectItem key={v} value={v}>{t(`status.${v}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('properties.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              <span dangerouslySetInnerHTML={{ __html: t('properties.delete.desc', { name: deleteTarget?.internal_identifier }) }} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('properties.delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('properties.delete.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
