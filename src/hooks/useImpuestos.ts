import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

export interface TaxObligation {
  id: string
  project_id: string
  property_id: string
  type: string
  responsible: string
  frequency: string
  due_date: string
  amount: number | null
  status: string
  active: boolean
  notes: string | null
  receipt_file_url: string | null
  created_at: string
  updated_at: string
  // enriched
  property_address: string
  property_identifier: string
}

export type TaxInsert = {
  property_id: string
  type: string
  responsible: string
  frequency: string
  due_date: string
  amount?: number | null
  notes?: string | null
  active?: boolean
}

export function useImpuestos() {
  const { projectId } = useProjectId()
  const { t } = useTranslation()
  const [taxes, setTaxes] = useState<TaxObligation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchImpuestos = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const [taxRes, propRes] = await Promise.all([
      supabase
        .from('tax_obligations')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true }),
      supabase
        .from('properties')
        .select('id, full_address, internal_identifier')
        .eq('project_id', projectId),
    ])

    const propMap = new Map<string, { address: string; identifier: string }>()
    ;(propRes.data ?? []).forEach(p =>
      propMap.set(p.id, { address: p.full_address, identifier: p.internal_identifier })
    )

    const enriched: TaxObligation[] = (taxRes.data ?? []).map(t => ({
      ...t,
      property_address: propMap.get(t.property_id)?.address ?? '—',
      property_identifier: propMap.get(t.property_id)?.identifier ?? '—',
    }))

    setTaxes(enriched)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchImpuestos()
  }, [fetchImpuestos])

  const crearImpuesto = async (data: TaxInsert) => {
    if (!projectId) return
    const { error } = await supabase.from('tax_obligations').insert({
      ...data,
      project_id: projectId,
    })
    if (error) {
      toast.error(t('taxes.toast.saveError'))
      return
    }
    toast.success(t('taxes.toast.created'))
    await fetchImpuestos()
  }

  const editarImpuesto = async (id: string, data: Partial<TaxInsert>) => {
    if (!projectId) return
    const { error } = await supabase
      .from('tax_obligations')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) {
      toast.error(t('taxes.toast.saveError'))
      return
    }
    toast.success(t('taxes.toast.updated'))
    await fetchImpuestos()
  }

  const marcarPagado = async (id: string, receiptUrl?: string) => {
    if (!projectId) return
    const payload: Record<string, unknown> = {
      status: 'paid',
      updated_at: new Date().toISOString(),
    }
    if (receiptUrl) payload.receipt_file_url = receiptUrl
    const { error } = await supabase
      .from('tax_obligations')
      .update(payload)
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) {
      toast.error(t('taxes.toast.saveError'))
      return
    }
    toast.success(t('taxes.toast.markedPaid'))
    await fetchImpuestos()
  }

  const marcarPendiente = async (id: string) => {
    if (!projectId) return
    const { error } = await supabase
      .from('tax_obligations')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) {
      toast.error(t('taxes.toast.saveError'))
      return
    }
    toast.success(t('taxes.toast.markedPending'))
    await fetchImpuestos()
  }

  return { taxes, loading, fetchImpuestos, crearImpuesto, editarImpuesto, marcarPagado, marcarPendiente }
}
