import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatDate, formatCurrency } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'

interface CuentaCorrienteRow {
  fecha: string
  concepto: string
  debito: number | null
  credito: number | null
  saldo: number
  tipo: 'due' | 'payment'
  estado?: string
}

interface Props {
  tenantId: string
  active: boolean
}

export default function CuentaCorriente({ tenantId, active }: Props) {
  const { t } = useTranslation()
  const { projectId } = useProjectId()
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<CuentaCorrienteRow[]>([])
  const [contractInfo, setContractInfo] = useState<{
    property: string
    currency: string
  } | null>(null)
  const [noContract, setNoContract] = useState(false)

  const fetchData = useCallback(async () => {
    if (!projectId || !tenantId) return
    setLoading(true)

    // 1. Get active contract
    const { data: contract } = await supabase
      .from('contracts')
      .select('id, current_rent, currency, property_id, properties(full_address)')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!contract) {
      setNoContract(true)
      setLoading(false)
      setLoaded(true)
      return
    }

    const prop = contract.properties as unknown as { full_address: string } | null
    setContractInfo({
      property: prop?.full_address ?? '—',
      currency: contract.currency ?? 'ARS',
    })

    // 2 & 3. Fetch dues and payments in parallel
    const [duesRes, paymentsRes] = await Promise.all([
      supabase
        .from('rent_dues')
        .select('id, period_month, due_date, expected_amount, balance_due, status')
        .eq('contract_id', contract.id)
        .order('due_date', { ascending: true }),
      supabase
        .from('payments')
        .select('id, amount, concept, method, paid_at')
        .eq('contract_id', contract.id)
        .order('paid_at', { ascending: true }),
    ])

    // Build timeline
    const timeline: Omit<CuentaCorrienteRow, 'saldo'>[] = []

    for (const d of duesRes.data ?? []) {
      timeline.push({
        fecha: d.due_date,
        concepto: `${t('tenants.cuentaCorriente.installment')} ${d.period_month}`,
        debito: d.expected_amount,
        credito: null,
        tipo: 'due',
        estado: d.status,
      })
    }

    for (const p of paymentsRes.data ?? []) {
      timeline.push({
        fecha: p.paid_at,
        concepto: p.concept ?? t('tenants.cuentaCorriente.payment'),
        debito: null,
        credito: p.amount,
        tipo: 'payment',
      })
    }

    // Sort by date ASC
    timeline.sort((a, b) => a.fecha.localeCompare(b.fecha))

    // Calculate running balance (debits increase debt, credits reduce it)
    let saldo = 0
    const computed: CuentaCorrienteRow[] = timeline.map(row => {
      if (row.debito != null) saldo += row.debito
      if (row.credito != null) saldo -= row.credito
      return { ...row, saldo }
    })

    setRows(computed)
    setLoading(false)
    setLoaded(true)
  }, [projectId, tenantId, t])

  useEffect(() => {
    if (active && !loaded) {
      fetchData()
    }
  }, [active, loaded, fetchData])

  if (!active) return null

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (noContract) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {t('tenants.cuentaCorriente.noActiveContract')}
      </p>
    )
  }

  const currentBalance = rows.length > 0 ? rows[rows.length - 1].saldo : 0
  const currency = contractInfo?.currency ?? 'ARS'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {t('tenants.cuentaCorriente.property')}: <span className="font-medium text-foreground">{contractInfo?.property}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground">{t('tenants.cuentaCorriente.currentBalance')}</span>
          <p className={`text-lg font-bold ${currentBalance > 0 ? 'text-destructive' : 'text-green-600'}`}>
            {formatCurrency(currentBalance, currency)}
          </p>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('tenants.cuentaCorriente.noMovements')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tenants.cuentaCorriente.date')}</TableHead>
              <TableHead>{t('tenants.cuentaCorriente.concept')}</TableHead>
              <TableHead className="text-right">{t('tenants.cuentaCorriente.debit')}</TableHead>
              <TableHead className="text-right">{t('tenants.cuentaCorriente.credit')}</TableHead>
              <TableHead className="text-right">{t('tenants.cuentaCorriente.balance')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={i}
                className={row.tipo === 'due' && row.saldo > 0 ? 'bg-destructive/5' : row.tipo === 'payment' ? 'bg-green-50 dark:bg-green-950/20' : ''}
              >
                <TableCell className="text-xs">{formatDate(row.fecha)}</TableCell>
                <TableCell className="text-xs">{row.concepto}</TableCell>
                <TableCell className="text-xs text-right">
                  {row.debito != null ? formatCurrency(row.debito, currency) : ''}
                </TableCell>
                <TableCell className="text-xs text-right">
                  {row.credito != null ? formatCurrency(row.credito, currency) : ''}
                </TableCell>
                <TableCell className={`text-xs text-right font-medium ${row.saldo > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {formatCurrency(row.saldo, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
