import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import type { Tables } from '@/integrations/supabase/types'

export type MaintenanceIssue = Tables<'maintenance_issues'>

export interface EnrichedIssue extends MaintenanceIssue {
  property_address: string
  property_identifier: string
}

export function useReparaciones() {
  const { projectId, loading: projectLoading } = useProjectId()
  const [issues, setIssues] = useState<EnrichedIssue[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReparaciones = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const [issuesRes, propsRes] = await Promise.all([
      supabase.from('maintenance_issues').select('*').eq('project_id', projectId).order('reported_at', { ascending: false }),
      supabase.from('properties').select('id, full_address, internal_identifier').eq('project_id', projectId),
    ])

    const propMap = new Map((propsRes.data ?? []).map(p => [p.id, { address: p.full_address, identifier: p.internal_identifier }]))

    const enriched: EnrichedIssue[] = (issuesRes.data ?? []).map(i => ({
      ...i,
      property_address: propMap.get(i.property_id)?.address ?? '—',
      property_identifier: propMap.get(i.property_id)?.identifier ?? '—',
    }))

    setIssues(enriched)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!projectLoading && projectId) {
      fetchReparaciones()
    } else if (!projectLoading) {
      setLoading(false)
    }
  }, [projectId, projectLoading, fetchReparaciones])

  const crearReparacion = async (data: {
    property_id: string
    description: string
    reported_at: string
    status: string
    requested_by: string
    payer: string
    estimate_amount: number | null
  }) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase.from('maintenance_issues').insert({
      project_id: projectId,
      property_id: data.property_id,
      description: data.description,
      reported_at: data.reported_at,
      status: data.status,
      requested_by: data.requested_by,
      payer: data.payer,
      estimate_amount: data.estimate_amount,
    })
    if (error) throw error
    await fetchReparaciones()
  }

  const editarReparacion = async (id: string, data: {
    property_id?: string
    description?: string
    reported_at?: string
    status?: string
    requested_by?: string
    payer?: string
    estimate_amount?: number | null
  }) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase.from('maintenance_issues')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) throw error
    await fetchReparaciones()
  }

  const eliminarReparacion = async (id: string) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase.from('maintenance_issues')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) throw error
    await fetchReparaciones()
  }

  return { issues, loading: loading || projectLoading, fetchReparaciones, crearReparacion, editarReparacion, eliminarReparacion, projectId }
}
