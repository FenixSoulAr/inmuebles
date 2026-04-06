import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, AlertTriangle, Clock, CheckCircle, Grid3X3, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useImpuestos, type TaxObligation, type TaxInsert } from '@/hooks/useImpuestos'
import ImpuestoForm from '@/components/impuestos/ImpuestoForm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

type ViewMode = 'annual' | 'list'

const MONTH_NAMES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function getDisplayStatus(tax: TaxObligation): string {
  if (tax.status === 'paid') return 'paid'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(tax.due_date)
  due.setHours(0, 0, 0, 0)
  if (due < today) return 'overdue'
  return 'pending'
}

export default function Impuestos() {
  const { t } = useTranslation()
  const { taxes, loading, crearImpuesto, editarImpuesto, marcarPagado, marcarPendiente } = useImpuestos()

  const [viewMode, setViewMode] = useState<ViewMode>('annual')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TaxObligation | null>(null)
  const [paySheetOpen, setPaySheetOpen] = useState(false)
  const [payTarget, setPayTarget] = useState<TaxObligation | null>(null)
  const [payNotes, setPayNotes] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterProperty, setFilterProperty] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Annual grid click → switch to list with filters
  const [annualCellFilter, setAnnualCellFilter] = useState<{ propertyId: string; month: number } | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const currentYear = new Date().getFullYear()

  // Available years
  const years = useMemo(() => {
    const ySet = new Set<number>()
    taxes.forEach(t => ySet.add(new Date(t.due_date).getFullYear()))
    ySet.add(currentYear)
    return Array.from(ySet).sort((a, b) => b - a)
  }, [taxes, currentYear])

  // Unique properties
  const uniqueProperties = useMemo(() => {
    const map = new Map<string, string>()
    taxes.forEach(t => map.set(t.property_id, t.property_address))
    return Array.from(map.entries())
  }, [taxes])

  // Summary cards
  const overdueCount = useMemo(() =>
    taxes.filter(t => getDisplayStatus(t) === 'overdue').length, [taxes])

  const next30Count = useMemo(() => {
    const in30 = new Date(today)
    in30.setDate(in30.getDate() + 30)
    return taxes.filter(t => {
      if (t.status === 'paid') return false
      const due = new Date(t.due_date)
      due.setHours(0, 0, 0, 0)
      return due >= today && due <= in30
    }).length
  }, [taxes, today])

  const paidThisYear = useMemo(() =>
    taxes.filter(t => t.status === 'paid' && new Date(t.due_date).getFullYear() === currentYear).length,
    [taxes, currentYear])

  // Filtered list
  const filteredTaxes = useMemo(() => {
    let list = taxes

    if (annualCellFilter) {
      list = list.filter(t => {
        const d = new Date(t.due_date)
        return t.property_id === annualCellFilter.propertyId && d.getMonth() === annualCellFilter.month && d.getFullYear() === Number(filterYear)
      })
      return list
    }

    if (filterYear !== 'all') {
      list = list.filter(t => new Date(t.due_date).getFullYear() === Number(filterYear))
    }
    if (filterProperty !== 'all') {
      list = list.filter(t => t.property_id === filterProperty)
    }
    if (filterType !== 'all') {
      list = list.filter(t => t.type === filterType)
    }
    if (filterStatus === 'overdue') {
      list = list.filter(t => getDisplayStatus(t) === 'overdue')
    } else if (filterStatus === 'paid') {
      list = list.filter(t => t.status === 'paid')
    } else if (filterStatus === 'pending') {
      list = list.filter(t => t.status === 'pending' && getDisplayStatus(t) !== 'overdue')
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.property_address.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [taxes, filterYear, filterProperty, filterType, filterStatus, search, annualCellFilter])

  // Annual grid data
  const annualGrid = useMemo(() => {
    const yr = Number(filterYear)
    const yearTaxes = taxes.filter(t => new Date(t.due_date).getFullYear() === yr)
    const propIds = [...new Set(yearTaxes.map(t => t.property_id))]

    return propIds.map(pid => {
      const propTaxes = yearTaxes.filter(t => t.property_id === pid)
      const propName = propTaxes[0]?.property_identifier || propTaxes[0]?.property_address || '—'
      const totalYear = propTaxes.length
      const paidYear = propTaxes.filter(t => t.status === 'paid').length

      const months = Array.from({ length: 12 }, (_, m) => {
        const monthTaxes = propTaxes.filter(t => new Date(t.due_date).getMonth() === m)
        if (monthTaxes.length === 0) return 'empty' as const
        const allPaid = monthTaxes.every(t => t.status === 'paid')
        if (allPaid) return 'paid' as const
        const anyOverdue = monthTaxes.some(t => {
          const due = new Date(t.due_date)
          due.setHours(0, 0, 0, 0)
          return t.status !== 'paid' && due < today
        })
        if (anyOverdue) return 'overdue' as const
        return 'pending' as const
      })

      return { propertyId: pid, propName, months, paidYear, totalYear }
    })
  }, [taxes, filterYear, today])

  const handleSave = async (data: TaxInsert) => {
    if (editing) {
      await editarImpuesto(editing.id, data)
    } else {
      await crearImpuesto(data)
    }
  }

  const openEdit = (tax: TaxObligation) => {
    setEditing(tax)
    setFormOpen(true)
  }

  const openPay = (tax: TaxObligation) => {
    setPayTarget(tax)
    setPayNotes('')
    setPaySheetOpen(true)
  }

  const confirmPay = async () => {
    if (!payTarget) return
    await marcarPagado(payTarget.id)
    setPaySheetOpen(false)
  }

  const handleCellClick = (propertyId: string, month: number) => {
    setAnnualCellFilter({ propertyId, month })
    setViewMode('list')
  }

  const clearCellFilter = () => {
    setAnnualCellFilter(null)
  }

  const statusBadge = (tax: TaxObligation) => {
    const ds = getDisplayStatus(tax)
    if (ds === 'paid') return <Badge variant="success">{t('taxes.status.paid')}</Badge>
    if (ds === 'overdue') return <Badge variant="destructive">{t('taxes.status.overdue')}</Badge>
    return <Badge variant="warning">{t('taxes.status.pending')}</Badge>
  }

  const typeBadge = (type: string) => (
    <Badge variant="outline">{t(`taxes.types.${type}`)}</Badge>
  )

  const responsibleBadge = (r: string) => (
    <Badge variant={r === 'owner' ? 'default' : 'secondary'}>
      {t(`taxes.responsible.${r}`)}
    </Badge>
  )

  const cellColor: Record<string, string> = {
    paid: 'bg-green-100 text-green-700 hover:bg-green-200',
    overdue: 'bg-red-100 text-red-700 hover:bg-red-200',
    pending: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
    empty: 'bg-muted text-muted-foreground',
  }
  const cellIcon: Record<string, string> = {
    paid: '✅',
    overdue: '❌',
    pending: '⏳',
    empty: '—',
  }

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('taxes.title')}</h2>
          <p className="text-muted-foreground">{t('taxes.subtitle')}</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />{t('taxes.new')}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-sm text-muted-foreground">{t('taxes.summary.overdue')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{next30Count}</p>
              <p className="text-sm text-muted-foreground">{t('taxes.summary.next30')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{paidThisYear}</p>
              <p className="text-sm text-muted-foreground">{t('taxes.summary.paidYear')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View toggle + year filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-md border overflow-hidden">
          <Button
            variant={viewMode === 'annual' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => { setViewMode('annual'); clearCellFilter() }}
          >
            <Grid3X3 className="h-4 w-4 mr-1" />{t('taxes.viewAnnual')}
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => { setViewMode('list'); clearCellFilter() }}
          >
            <List className="h-4 w-4 mr-1" />{t('taxes.viewList')}
          </Button>
        </div>

        <Select value={filterYear} onValueChange={v => { setFilterYear(v); clearCellFilter() }}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {viewMode === 'list' && (
          <>
            <Select value={filterProperty} onValueChange={v => { setFilterProperty(v); clearCellFilter() }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('taxes.filters.allProperties')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('taxes.filters.allProperties')}</SelectItem>
                {uniqueProperties.map(([id, addr]) => (
                  <SelectItem key={id} value={id}>{addr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={v => { setFilterType(v); clearCellFilter() }}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('taxes.filters.allTypes')}</SelectItem>
                <SelectItem value="municipal">{t('taxes.types.municipal')}</SelectItem>
                <SelectItem value="property">{t('taxes.types.property')}</SelectItem>
                <SelectItem value="provincial">{t('taxes.types.provincial')}</SelectItem>
                <SelectItem value="other">{t('taxes.types.other')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); clearCellFilter() }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('taxes.filters.allStatus')}</SelectItem>
                <SelectItem value="pending">{t('taxes.status.pending')}</SelectItem>
                <SelectItem value="paid">{t('taxes.status.paid')}</SelectItem>
                <SelectItem value="overdue">{t('taxes.status.overdue')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={t('taxes.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-[200px]"
            />
          </>
        )}

        {annualCellFilter && (
          <Button variant="outline" size="sm" onClick={clearCellFilter}>
            ✕ {t('taxes.clearFilter')}
          </Button>
        )}
      </div>

      {/* Annual View */}
      {viewMode === 'annual' && (
        <div className="overflow-x-auto">
          <h3 className="font-semibold mb-3">{t('taxes.annualTitle', { year: filterYear })}</h3>
          {annualGrid.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{t('taxes.emptyTitle')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">{t('taxes.columns.property')}</TableHead>
                  {MONTH_NAMES_ES.map(m => (
                    <TableHead key={m} className="text-center w-[60px]">{m}</TableHead>
                  ))}
                  <TableHead className="text-center">{t('taxes.annualPaid')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {annualGrid.map(row => (
                  <TableRow key={row.propertyId}>
                    <TableCell className="font-medium">{row.propName}</TableCell>
                    {row.months.map((status, m) => (
                      <TableCell key={m} className="p-1 text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className={cn(
                                  'w-full rounded-md py-1 text-xs font-medium cursor-pointer transition-colors',
                                  cellColor[status]
                                )}
                                onClick={() => status !== 'empty' && handleCellClick(row.propertyId, m)}
                                disabled={status === 'empty'}
                              >
                                {cellIcon[status]}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {MONTH_NAMES_ES[m]} — {t(`taxes.cellStatus.${status}`)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-sm">
                      <span className={row.paidYear === row.totalYear ? 'text-green-600 font-semibold' : ''}>
                        {row.paidYear}/{row.totalYear}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {filteredTaxes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold mb-1">{t('taxes.emptyTitle')}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t('taxes.emptyDesc')}</p>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('taxes.columns.property')}</TableHead>
                  <TableHead>{t('taxes.columns.type')}</TableHead>
                  <TableHead>{t('taxes.columns.responsible')}</TableHead>
                  <TableHead>{t('taxes.columns.frequency')}</TableHead>
                  <TableHead>{t('taxes.columns.dueDate')}</TableHead>
                  <TableHead>{t('taxes.columns.amount')}</TableHead>
                  <TableHead>{t('taxes.columns.status')}</TableHead>
                  <TableHead>{t('taxes.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTaxes.map(tax => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-medium">{tax.property_address}</TableCell>
                    <TableCell>{typeBadge(tax.type)}</TableCell>
                    <TableCell>{responsibleBadge(tax.responsible)}</TableCell>
                    <TableCell className="text-sm">{t(`taxes.frequencies.${tax.frequency}`)}</TableCell>
                    <TableCell className="text-sm">{formatDate(tax.due_date)}</TableCell>
                    <TableCell className="text-sm">
                      {tax.amount != null ? formatCurrency(tax.amount) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{statusBadge(tax)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {tax.status !== 'paid' && (
                          <Button variant="outline" size="sm" onClick={() => openPay(tax)}>
                            $
                          </Button>
                        )}
                        {tax.status === 'paid' && (
                          <Button variant="ghost" size="sm" onClick={() => marcarPendiente(tax.id)}>
                            ↩
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(tax)}>
                          {t('taxes.editBtn')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {/* Form Sheet */}
      <ImpuestoForm
        open={formOpen}
        onOpenChange={v => { setFormOpen(v); if (!v) setEditing(null) }}
        onSave={handleSave}
        editing={editing}
      />

      {/* Pay Confirmation Sheet */}
      <Sheet open={paySheetOpen} onOpenChange={setPaySheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('taxes.payForm.title')}</SheetTitle>
            <SheetDescription>{t('taxes.payForm.desc')}</SheetDescription>
          </SheetHeader>
          {payTarget && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2 text-sm">
                <p><strong>{t('taxes.columns.property')}:</strong> {payTarget.property_address}</p>
                <p><strong>{t('taxes.columns.type')}:</strong> {t(`taxes.types.${payTarget.type}`)}</p>
                <p><strong>{t('taxes.columns.dueDate')}:</strong> {formatDate(payTarget.due_date)}</p>
                <p><strong>{t('taxes.columns.amount')}:</strong> {payTarget.amount != null ? formatCurrency(payTarget.amount) : '—'}</p>
              </div>

              <div>
                <Label>{t('taxes.payForm.notes')}</Label>
                <Textarea
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder={t('taxes.payForm.notesPlaceholder')}
                />
              </div>

              <Button onClick={confirmPay} className="w-full">
                {t('taxes.payForm.confirm')}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
