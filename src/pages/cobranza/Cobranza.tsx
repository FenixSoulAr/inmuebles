import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Eye, DollarSign, Search, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/utils'
import { useCobranza, type EnrichedRentDue } from '@/hooks/useCobranza'
import PagoForm from '@/components/cobranza/PagoForm'
import CobranzaDetail from '@/components/cobranza/CobranzaDetail'

const statusVariant: Record<string, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  overdue: 'destructive', partial: 'warning', paid: 'success', upcoming: 'secondary',
}

export default function Cobranza() {
  const { t } = useTranslation()
  const { dues, loading, registrarPago, fetchPagos } = useCobranza()
  const [filter, setFilter] = useState('current_month')
  const [search, setSearch] = useState('')
  const [detailDue, setDetailDue] = useState<EnrichedRentDue | null>(null)
  const [payDue, setPayDue] = useState<EnrichedRentDue | null>(null)

  const summary = useMemo(() => {
    const overdue = dues.filter(d => d.display_status === 'overdue')
    const upcoming = dues.filter(d => d.display_status === 'upcoming')
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const paidThisMonth = dues.filter(d => d.display_status === 'paid' && d.period_month === thisMonth)
    return {
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, d) => s + Number(d.balance_due), 0),
      upcomingCount: upcoming.length,
      upcomingAmount: upcoming.reduce((s, d) => s + Number(d.balance_due), 0),
      paidAmount: paidThisMonth.reduce((s, d) => s + Number(d.expected_amount), 0),
    }
  }, [dues])

  const currentMonth = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const currentMonthLabel = useMemo(() => {
    const now = new Date()
    return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(now)
  }, [])

  const filtered = useMemo(() => {
    let list = dues
    if (filter === 'current_month') {
      list = list.filter(d => d.period_month === currentMonth)
    } else if (filter !== 'all') {
      list = list.filter(d => d.display_status === filter)
    }

    if (filter === 'overdue') {
      list = [...list].sort((a, b) => b.days_overdue - a.days_overdue)
    } else if (filter === 'current_month') {
      list = [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d => d.tenant_name.toLowerCase().includes(q) || d.property_address.toLowerCase().includes(q))
    }
    return list
  }, [dues, filter, search, currentMonth])

  const handlePay = async (rentDueId: string, data: { amount: number; method: string; payment_date: string; notes: string }) => {
    try {
      await registrarPago(rentDueId, data)
      toast.success(t('billing.toast.paymentRegistered'))
    } catch {
      toast.error(t('billing.toast.paymentError'))
      throw new Error()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h2>
        <p className="text-muted-foreground">{t('billing.subtitle')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('overdue')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t('billing.summary.overdue')}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-destructive">{formatCurrency(summary.overdueAmount)}</span>
              <Badge variant="destructive">{summary.overdueCount}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('upcoming')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('billing.summary.upcoming')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(summary.upcomingAmount)}</span>
              <Badge variant="secondary">{summary.upcomingCount}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('billing.summary.upcomingDesc')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t('billing.summary.collected')}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600">{formatCurrency(summary.paidAmount)}</span>
              <Badge variant="success">{t('billing.summary.thisMonth')}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('billing.search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month">{t('billing.filters.currentMonth')}</SelectItem>
            <SelectItem value="all">{t('billing.filters.all')}</SelectItem>
            <SelectItem value="overdue">{t('billing.filters.overdue')}</SelectItem>
            <SelectItem value="upcoming">{t('billing.filters.upcoming')}</SelectItem>
            <SelectItem value="partial">{t('billing.filters.partial')}</SelectItem>
            <SelectItem value="paid">{t('billing.filters.paid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Current month header */}
      {filter === 'current_month' && filtered.length > 0 && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
          <span className="font-semibold capitalize">
            {t('billing.currentMonthHeader', { month: currentMonthLabel })} ({filtered.length})
          </span>
        </div>
      )}

      {/* Overdue header */}
      {filter === 'overdue' && filtered.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="font-semibold text-destructive">
            {filtered.length} {t('billing.overdueHeader.count')} — {t('billing.overdueHeader.total')}: {formatCurrency(filtered.reduce((s, d) => s + d.total_due, 0))}
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">{t('billing.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('billing.emptyDesc')}</p>
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
                      <TableHead>{t('billing.columns.tenant')}</TableHead>
                      <TableHead>{t('billing.columns.property')}</TableHead>
                      <TableHead>{t('billing.columns.period')}</TableHead>
                      <TableHead className="text-right">{t('billing.columns.expected')}</TableHead>
                      <TableHead className="text-right">{t('billing.columns.balance')}</TableHead>
                      <TableHead className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">{t('billing.columns.daysOverdue')} <Info className="h-3 w-3 text-muted-foreground" /></span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px] text-xs">{t('billing.columns.daysOverdueTooltip')}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">{t('billing.columns.interest')} <Info className="h-3 w-3 text-muted-foreground" /></span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px] text-xs">{t('billing.columns.interestTooltip')}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="text-right">{t('billing.columns.totalDue')}</TableHead>
                      <TableHead className="text-center">{t('billing.columns.status')}</TableHead>
                      <TableHead className="text-center">{t('billing.columns.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{d.tenant_name}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{d.property_address}</TableCell>
                        <TableCell className="text-sm">{d.period_month}</TableCell>
                        <TableCell className="text-sm text-right">{formatCurrency(Number(d.expected_amount), d.currency)}</TableCell>
                        <TableCell className="text-sm text-right">{formatCurrency(Number(d.balance_due), d.currency)}</TableCell>
                        <TableCell className="text-sm text-center">
                          {d.display_status === 'overdue' ? (
                            d.days_overdue > 0 ? (
                              <span className="text-destructive font-medium">{d.days_overdue}*</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">{t('billing.detail.gracePeriod')}</span>
                            )
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {d.display_status === 'overdue' && d.interest_amount > 0 ? (
                            <span className="text-orange-600">{formatCurrency(d.interest_amount, d.currency)}</span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className={`text-sm text-right ${d.display_status === 'overdue' ? 'font-bold' : ''}`}>
                          {formatCurrency(d.total_due, d.currency)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={statusVariant[d.display_status] ?? 'secondary'}>{t(`billing.status.${d.display_status}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setDetailDue(d)}><Eye className="h-4 w-4" /></Button>
                            {d.display_status !== 'paid' && (
                              <Button variant="ghost" size="icon" onClick={() => setPayDue(d)}><DollarSign className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {filtered.some(d => d.display_status === 'overdue' && d.days_overdue > 0) && (
              <p className="text-xs text-muted-foreground mt-2 px-1">{t('billing.columns.daysOverdueFootnote')}</p>
            )}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(d => (
              <Card key={d.id} className="cursor-pointer" onClick={() => setDetailDue(d)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{d.tenant_name}</span>
                    <Badge variant={statusVariant[d.display_status] ?? 'secondary'}>{t(`billing.status.${d.display_status}`)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{d.property_address}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{d.period_month}</span>
                    <span className={d.display_status === 'overdue' ? 'font-bold text-destructive' : 'font-medium'}>{formatCurrency(d.total_due, d.currency)}</span>
                  </div>
                  {d.display_status === 'overdue' && d.days_overdue > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-destructive">{d.days_overdue} {t('billing.detail.days')} {t('billing.columns.daysOverdue').toLowerCase()}</span>
                      {d.interest_amount > 0 && <span className="text-orange-600">{t('billing.columns.interest')}: {formatCurrency(d.interest_amount, d.currency)}</span>}
                    </div>
                  )}
                  {d.display_status !== 'paid' && (
                    <Button size="sm" className="w-full mt-1" onClick={e => { e.stopPropagation(); setPayDue(d) }}>
                      <DollarSign className="h-3 w-3 mr-1" />{t('billing.payForm.submit')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <CobranzaDetail
        open={!!detailDue}
        onOpenChange={open => { if (!open) setDetailDue(null) }}
        due={detailDue}
        fetchPagos={fetchPagos}
        onRegisterPayment={() => { setPayDue(detailDue); setDetailDue(null) }}
      />

      <PagoForm
        open={!!payDue}
        onOpenChange={open => { if (!open) setPayDue(null) }}
        due={payDue}
        onSave={handlePay}
      />
    </div>
  )
}
