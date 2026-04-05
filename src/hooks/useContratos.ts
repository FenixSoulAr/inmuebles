import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import type { Tables } from '@/integrations/supabase/types'

export type Contract = Tables<'contracts'>
export type ContractService = Tables<'contract_services'>
export type ContractAdjustment = Tables<'contract_adjustments'>

export interface ContractEnriched extends Contract {
  property_address: string
  tenant_name: string
}

export interface ServiceForm {
  id?: string
  service_type: string
  active: boolean
  due_day: number
  expected_amount: number
}

export function useContratos() {
  const { projectId, loading: projectLoading } = useProjectId()
  const [contratos, setContratos] = useState<ContractEnriched[]>([])
  const [loading, setLoading] = useState(true)

  const fetchContratos = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date', { ascending: false })
    if (error) throw error

    const { data: properties } = await supabase
      .from('properties')
      .select('id, full_address')
      .eq('project_id', projectId)

    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, full_name')
      .eq('project_id', projectId)

    const propMap = new Map(properties?.map(p => [p.id, p.full_address]) ?? [])
    const tenantMap = new Map(tenants?.map(t => [t.id, t.full_name]) ?? [])

    const enriched: ContractEnriched[] = (contracts ?? []).map(c => ({
      ...c,
      property_address: propMap.get(c.property_id) ?? '—',
      tenant_name: tenantMap.get(c.tenant_id) ?? '—',
    }))

    setContratos(enriched)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!projectLoading && projectId) {
      fetchContratos()
    } else if (!projectLoading) {
      setLoading(false)
    }
  }, [projectId, projectLoading, fetchContratos])

  const crearContrato = async (data: Record<string, any>, services: ServiceForm[]) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { data: created, error } = await supabase
      .from('contracts')
      .insert({ ...data, project_id: projectId })
      .select('id')
      .single()
    if (error) throw error
    if (services.length > 0) {
      const { error: sErr } = await supabase
        .from('contract_services')
        .insert(services.map(s => ({
          contract_id: created.id,
          project_id: projectId,
          service_type: s.service_type,
          active: s.active,
          due_day: s.due_day || null,
          expected_amount: s.expected_amount || null,
        })))
      if (sErr) throw sErr
    }
    await fetchContratos()
  }

  const editarContrato = async (id: string, data: Record<string, any>, services: ServiceForm[]) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase
      .from('contracts')
      .update(data)
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) throw error

    // Delete existing services and re-insert
    await supabase.from('contract_services').delete().eq('contract_id', id).eq('project_id', projectId)
    if (services.length > 0) {
      const { error: sErr } = await supabase
        .from('contract_services')
        .insert(services.map(s => ({
          contract_id: id,
          project_id: projectId,
          service_type: s.service_type,
          active: s.active,
          due_day: s.due_day || null,
          expected_amount: s.expected_amount || null,
        })))
      if (sErr) throw sErr
    }
    await fetchContratos()
  }

  const toggleActivo = async (id: string, currentActive: boolean) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase
      .from('contracts')
      .update({ is_active: !currentActive })
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) throw error
    await fetchContratos()
  }

  const fetchServices = async (contractId: string): Promise<ContractService[]> => {
    if (!projectId) return []
    const { data } = await supabase
      .from('contract_services')
      .select('*')
      .eq('contract_id', contractId)
      .eq('project_id', projectId)
    return data ?? []
  }

  const fetchAdjustments = async (contractId: string): Promise<ContractAdjustment[]> => {
    if (!projectId) return []
    const { data } = await supabase
      .from('contract_adjustments')
      .select('*')
      .eq('contract_id', contractId)
      .eq('project_id', projectId)
      .order('adjustment_date', { ascending: false })
    return data ?? []
  }

  const fetchPropertyOptions = async () => {
    if (!projectId) return []
    const { data } = await supabase
      .from('properties')
      .select('id, full_address')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('full_address')
    return data ?? []
  }

  const fetchTenantOptions = async () => {
    if (!projectId) return []
    const { data } = await supabase
      .from('tenants')
      .select('id, full_name')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('full_name')
    return data ?? []
  }

  return {
    contratos,
    loading: loading || projectLoading,
    crearContrato,
    editarContrato,
    toggleActivo,
    fetchServices,
    fetchAdjustments,
    fetchPropertyOptions,
    fetchTenantOptions,
  }
}
