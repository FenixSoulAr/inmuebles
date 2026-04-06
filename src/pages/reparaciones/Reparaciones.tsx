import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Wrench, Search, Eye, Pencil, Trash2, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useReparaciones, type EnrichedIssue } from '@/hooks/useReparaciones'
import ReparacionForm from '@/components/reparaciones/ReparacionForm'
import ReparacionDetail from '@/components/reparaciones/ReparacionDetail'
import { cn } from '@/lib/utils'

const statusVariant: Record<string, 'warning' | 'default' | 'secondary' | 'success'> = {
  pending: 'warning',
  open: 'default',
  in_progress: 'secondary',
  resolved: 'success',
}

export default function Reparaciones() {
  const { t } = useTranslation()
  const { issues, loading, crearReparacion, editarReparacion, eliminarReparacion, projectId } = useReparaciones()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [detailIssue, setDetailIssue] = useState<EnrichedIssue | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editIssue, setEditIssue] = useState<EnrichedIssue | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnrichedIssue | null>(null)
  const [blockedDelete, setBlockedDelete] = useState(false)

  const summary = useMemo(() => {
    const active = issues.filter(i => ['open', 'in_progress', 'pending'].includes(i.status))
    const noEstimate = issues.filter(i => i.estimate_amount == null && i.status !== 'resolved')
    const resolved = issues.filter(i => i.status === 'resolved')
    return { activeCount: active.length, noEstimateCount: noEstimate.length, resolvedCount: resolved.length }
  }, [issues])

  const filtered = useMemo(() => {
    let list = issues
    if (filter !== 'all') {
      list = list.filter(i => i.status === filter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i => i.description.toLowerCase().includes(q) || i.property_address.toLowerCase().includes(q))
    }
    return list
  }, [issues, filter, search])

  const handleCreate = () => {
    setEditIssue(null)
    setFormOpen(true)
  }

  const handleEdit = (issue: EnrichedIssue) => {
    setDetailIssue(null)
    setEditIssue(issue)
    setFormOpen(true)
  }

  const handleSave = async (data: any) => {
    try {
      if (editIssue) {
        await editarReparacion(editIssue.id, data)
        toast.success(t('repairs.toast.updated'))
      } else {
        await crearReparacion(data)
        toast.success(t('repairs.toast.created'))
      }
    } catch {
      toast.error(t('repairs.toast.saveError'))
      throw new Error()
    }
  }

  const handleDeleteAttempt = (issue: EnrichedIssue) => {
    if (issue.status !== 'resolved') {
      setBlockedDelete(true)
      return
    }
    setDeleteTarget(issue)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await eliminarReparacion(deleteTarget.id)
      toast.success(t('repairs.toast.deleted'))
      setDeleteTarget(null)
      setDetailIssue(null)
    } catch {
      toast.error(t('repairs.toast.deleteError'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('repairs.title')}</h2>
          <p className="text-muted-foreground">{t('repairs.subtitle')}</p>
        </div>
        <Button onClick={handleCreate}><Plus className="h-4 w-4" />{t('repairs.new')}</Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={cn('cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all', filter === 'all' && summary.activeCount > 0 && 'ring-2 ring-primary')} onClick={() => setFilter('all')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-destructive" />
              {t('repairs.summary.active')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-destructive">{summary.activeCount}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {t('repairs.summary.noEstimate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-orange-600">{summary.noEstimateCount}</span>
          </CardContent>
        </Card>

        <Card className={cn('cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all', filter === 'resolved' && 'ring-2 ring-primary')} onClick={() => setFilter('resolved')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-600" />
              {t('repairs.summary.resolved')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-green-600">{summary.resolvedCount}</span>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('repairs.search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('repairs.filters.all')}</SelectItem>
            <SelectItem value="pending">{t('repairs.filters.pending')}</SelectItem>
            <SelectItem value="open">{t('repairs.filters.open')}</SelectItem>
            <SelectItem value="in_progress">{t('repairs.filters.in_progress')}</SelectItem>
            <SelectItem value="resolved">{t('repairs.filters.resolved')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">{t('repairs.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('repairs.emptyDesc')}</p>
            <Button onClick={handleCreate}><Plus className="h-4 w-4" />{t('repairs.new')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('repairs.columns.property')}</TableHead>
                      <TableHead>{t('repairs.columns.description')}</TableHead>
                      <TableHead>{t('repairs.columns.requestedBy')}</TableHead>
                      <TableHead>{t('repairs.columns.payer')}</TableHead>
                      <TableHead className="text-right">{t('repairs.columns.estimate')}</TableHead>
                      <TableHead className="text-center">{t('repairs.columns.status')}</TableHead>
                      <TableHead className="text-center">{t('repairs.columns.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="text-sm max-w-[180px] truncate">{i.property_address}</TableCell>
                        <TableCell className="text-sm max-w-[220px] truncate">{i.description}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="secondary">{t(`repairs.payers.${i.requested_by}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="secondary" className={i.payer === 'tenant' ? 'bg-purple-100 text-purple-800 border-transparent' : 'bg-blue-100 text-blue-800 border-transparent'}>{t(`repairs.payers.${i.payer}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {i.estimate_amount != null ? formatCurrency(Number(i.estimate_amount)) : (
                            <span className="text-orange-500 text-xs">{t('repairs.detail.noEstimate')}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={statusVariant[i.status] ?? 'secondary'}>{t(`repairs.statuses.${i.status}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setDetailIssue(i)}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(i)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAttempt(i)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(i => (
              <Card key={i.id} className="cursor-pointer" onClick={() => setDetailIssue(i)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate max-w-[200px]">{i.description}</span>
                    <Badge variant={statusVariant[i.status] ?? 'secondary'}>{t(`repairs.statuses.${i.status}`)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{i.property_address}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{formatDate(i.reported_at)}</span>
                    <span className="font-medium">
                      {i.estimate_amount != null ? formatCurrency(Number(i.estimate_amount)) : (
                        <span className="text-orange-500 text-xs">{t('repairs.detail.noEstimate')}</span>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Detail sheet */}
      <ReparacionDetail
        open={!!detailIssue}
        onOpenChange={o => !o && setDetailIssue(null)}
        issue={detailIssue}
        onEdit={() => detailIssue && handleEdit(detailIssue)}
        onDelete={() => detailIssue && handleDeleteAttempt(detailIssue)}
      />

      {/* Form sheet */}
      <ReparacionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        projectId={projectId}
        issue={editIssue}
        onSave={handleSave}
      />

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('repairs.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('repairs.delete.desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>{t('repairs.delete.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blocked delete dialog */}
      <AlertDialog open={blockedDelete} onOpenChange={setBlockedDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('repairs.delete.blockedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('repairs.delete.blockedDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBlockedDelete(false)}>{t('repairs.delete.ok')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
