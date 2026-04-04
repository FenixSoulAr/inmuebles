import { useState } from 'react'
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

const TYPE_OPTIONS = [
  { value: 'apartment', label: 'Departamento' },
  { value: 'house', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'office', label: 'Oficina' },
  { value: 'warehouse', label: 'Depósito' },
] as const

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponible' },
  { value: 'rented', label: 'Alquilada' },
  { value: 'maintenance', label: 'En reparación' },
] as const

const statusLabel: Record<string, string> = { rented: 'Alquilada', available: 'Disponible', vacant: 'Disponible', maintenance: 'En reparación' }
const statusVariant: Record<string, 'success' | 'default' | 'warning'> = { rented: 'success', available: 'default', vacant: 'default', maintenance: 'warning' }
const typeLabel: Record<string, string> = { apartment: 'Departamento', house: 'Casa', ph: 'PH', local: 'Local', office: 'Oficina', warehouse: 'Depósito', commercial: 'Local' }

const emptyForm = { full_address: '', internal_identifier: '', type: 'apartment', status: 'available' }

export default function Propiedades() {
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
      toast.error('Completá todos los campos obligatorios')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await editarPropiedad(editingId, form)
        toast.success('Propiedad actualizada')
      } else {
        await crearPropiedad(form as PropiedadInsert)
        toast.success('Propiedad creada')
      }
      setDialogOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await eliminarPropiedad(deleteTarget.id)
      toast.success('Propiedad eliminada')
    } catch (e: any) {
      toast.error(e.message ?? 'Error al eliminar')
    } finally {
      setDeleteTarget(null)
    }
  }

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge variant={statusVariant[status] ?? 'default'}>{statusLabel[status] ?? status}</Badge>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Propiedades</h2>
          <p className="text-muted-foreground">Gestioná tu cartera de inmuebles</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Nueva propiedad</Button>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar propiedad..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando propiedades…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">Sin propiedades registradas</h3>
            <p className="text-sm text-muted-foreground mb-4">Comenzá agregando tu primera propiedad</p>
            <Button onClick={openCreate}><Plus className="h-4 w-4" />Agregar propiedad</Button>
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
                    <TableHead>Dirección</TableHead>
                    <TableHead>ID interno</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_address}</TableCell>
                      <TableCell>{p.internal_identifier}</TableCell>
                      <TableCell>{typeLabel[p.type] ?? p.type}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
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

          {/* Mobile cards */}
          <div className="grid gap-4 md:hidden">
            {filtered.map(p => (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{p.internal_identifier}</p>
                      <p className="text-xs text-muted-foreground">{typeLabel[p.type] ?? p.type}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{p.full_address}</p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteTarget(p)}><Trash2 className="h-3 w-3 mr-1 text-destructive" />Eliminar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar propiedad' : 'Nueva propiedad'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Modificá los datos de la propiedad' : 'Completá los datos para registrar una nueva propiedad'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_address">Dirección completa *</Label>
              <Input id="full_address" value={form.full_address} onChange={e => setForm(f => ({ ...f, full_address: e.target.value }))} placeholder="Av. Corrientes 1234, CABA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_identifier">Identificador interno *</Label>
              <Input id="internal_identifier" value={form.internal_identifier} onChange={e => setForm(f => ({ ...f, internal_identifier: e.target.value }))} placeholder="PROP-001" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar propiedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.internal_identifier}</strong>. Esta acción se puede revertir desde la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
