import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import { resolveRentObligationId } from '@/lib/obligations'
import { toast } from 'sonner'
import type { Tables } from '@/integrations/supabase/types'

export type RentDue = Tables<'rent_dues'>
export type RentPayment = Tables<'rent_payments'>

export type DisplayStatus = 'paid' | 'upcoming' | 'partial' | 'overdue'

export interface EnrichedRentDue extends RentDue {
  tenant_name: string
  property_address: string
  currency: string
  interest_rate: number | null
  grace_days: number
  days_overdue: number
  interest_amount: number
  total_due: number
  display_status: DisplayStatus
}

export function useCobranza() {
  const { projectId, loading: projectLoading } = useProjectId()
  const [dues, setDues] = useState<EnrichedRentDue[]>([])
  const [loading, setLoading] = useState(true)
  const [thisMonthTotal, setThisMonthTotal] = useState(0)
  const [thisMonthPaidDueIds, setThisMonthPaidDueIds] = useState<Set<string>>(new Set())
  const [thisMonthPaymentMap, setThisMonthPaymentMap] = useState<Map<string, string>>(new Map())

  const fetchCobranza = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const now = new Date()
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const [duesRes, tenantsRes, propsRes, contractsRes, paymentsRes] = await Promise.all([
      supabase.from('rent_dues').select('*').eq('project_id', projectId).order('due_date', { ascending: false }),
      supabase.from('tenants').select('id, full_name').eq('project_id', projectId),
      supabase.from('properties').select('id, full_address').eq('project_id', projectId),
      supabase.from('contracts').select('id, interest_rate, grace_days, currency, is_active, end_date').eq('project_id', projectId),
      supabase.from('rent_payments').select('rent_due_id, amount, payment_date').eq('project_id', projectId).gte('payment_date', firstDay).lte('payment_date', todayStr),
    ])

    // This month payments
    const paidIds = new Set<string>()
    const payDateMap = new Map<string, string>()
    let paidTotal = 0
    for (const p of paymentsRes.data ?? []) {
      paidIds.add(p.rent_due_id)
      paidTotal += Number(p.amount)
      const existing = payDateMap.get(p.rent_due_id)
      if (!existing || p.payment_date > existing) {
        payDateMap.set(p.rent_due_id, p.payment_date)
      }
    }
    setThisMonthTotal(paidTotal)
    setThisMonthPaidDueIds(paidIds)
    setThisMonthPaymentMap(payDateMap)

    const tenantMap = new Map((tenantsRes.data ?? []).map(t => [t.id, t.full_name]))
    const propMap = new Map((propsRes.data ?? []).map(p => [p.id, p.full_address]))
    const contractMap = new Map((contractsRes.data ?? []).map(c => [c.id, {
      interest_rate: c.interest_rate,
      grace_days: c.grace_days ?? 0,
      currency: c.currency ?? 'ARS',
      is_active: c.is_active,
      end_date: c.end_date,
    }]))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const enriched: EnrichedRentDue[] = (duesRes.data ?? []).filter(d => {
      const contract = contractMap.get(d.contract_id)
      if (!contract) return false
      if (contract.is_active) return true
      return contract.end_date ? d.due_date <= contract.end_date : false
    }).map(d => {
      const contract = contractMap.get(d.contract_id) ?? { interest_rate: null, grace_days: 0, currency: 'ARS', is_active: false, end_date: null }
      const dueDate = new Date(d.due_date)
      dueDate.setHours(0, 0, 0, 0)

      let display_status: DisplayStatus
      if (Number(d.balance_due) <= 0) {
        display_status = 'paid'
      } else if (dueDate >= today) {
        display_status = 'upcoming'
      } else if (Number(d.balance_due) < Number(d.expected_amount)) {
        display_status = 'partial'
      } else {
        display_status = 'overdue'
      }

      let days_overdue = 0
      if (display_status === 'overdue') {
        const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        days_overdue = Math.max(0, diffDays - contract.grace_days)
      }
      let interest_amount = 0
      if (contract.interest_rate && days_overdue > 0) {
        interest_amount = Math.round(Number(d.balance_due) * (contract.interest_rate / 100) * (days_overdue / 30) * 100) / 100
      }
      return {
        ...d,
        tenant_name: tenantMap.get(d.tenant_id) ?? '—',
        property_address: propMap.get(d.property_id) ?? '—',
        currency: contract.currency,
        interest_rate: contract.interest_rate,
        grace_days: contract.grace_days,
        days_overdue,
        interest_amount,
        total_due: Number(d.balance_due) + interest_amount,
        display_status,
      }
    })

    setDues(enriched)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!projectLoading && projectId) {
      fetchCobranza()
    } else if (!projectLoading) {
      setLoading(false)
    }
  }, [projectId, projectLoading, fetchCobranza])

  const registrarPago = async (rentDueId: string, data: {
    amount: number
    method: string
    payment_date: string
    notes: string
  }) => {
    if (!projectId) throw new Error('Sin proyecto activo')

    const due = dues.find(d => d.id === rentDueId)
    if (!due) throw new Error('Cuota no encontrada')

    // 1. Legacy: insert in rent_payments
    const { error: payError } = await supabase.from('rent_payments').insert({
      rent_due_id: rentDueId,
      project_id: projectId,
      amount: data.amount,
      method: data.method,
      payment_date: data.payment_date,
      notes: data.notes || null,
    })
    if (payError) throw payError

    // 2. Update rent_due balance/status
    const newBalance = Math.max(0, Number(due.balance_due) - data.amount)
    const newStatus = newBalance <= 0 ? 'paid' : 'partial'

    const { error: updateError } = await supabase
      .from('rent_dues')
      .update({ balance_due: newBalance, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', rentDueId)
      .eq('project_id', projectId)
    if (updateError) throw updateError

    // 3. Resolve canonical obligation_id
    const obligationId = await resolveRentObligationId({
      projectId,
      contractId: due.contract_id,
      propertyId: due.property_id,
      tenantId: due.tenant_id,
      periodMonth: due.period_month,
      dueDate: due.due_date,
      expectedAmount: Number(due.expected_amount),
      currency: due.currency ?? 'ARS',
    })
    if (!obligationId) {
      toast.error('No se pudo vincular el pago a la obligación canónica')
      await fetchCobranza()
      return
    }

    // 4. Insert canonical payment
    const { error: canonicalErr } = await supabase.from('payments').insert({
      project_id: projectId,
      contract_id: due.contract_id,
      obligation_id: obligationId,
      amount: data.amount,
      method: data.method,
      concept: `Alquiler ${due.period_month}`,
      paid_at: data.payment_date,
      notes: data.notes || null,
    })
    if (canonicalErr) {
      toast.error('Error al registrar pago canónico: ' + canonicalErr.message)
      await fetchCobranza()
      return
    }

    // 5. If fully paid, mark obligation as confirmed
    if (newStatus === 'paid') {
      await supabase
        .from('obligations')
        .update({ status: 'confirmed' })
        .eq('id', obligationId)
    }

    await fetchCobranza()
  }

  const fetchPagos = async (rentDueId: string): Promise<RentPayment[]> => {
    if (!projectId) return []
    const { data } = await supabase
      .from('rent_payments')
      .select('*')
      .eq('rent_due_id', rentDueId)
      .eq('project_id', projectId)
      .order('payment_date', { ascending: false })
    return data ?? []
  }

  return { dues, loading: loading || projectLoading, fetchCobranza, registrarPago, fetchPagos, thisMonthTotal, thisMonthPaidDueIds, thisMonthPaymentMap }
}
