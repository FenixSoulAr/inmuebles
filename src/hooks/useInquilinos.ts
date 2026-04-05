import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'

export type Tenant = Tables<'tenants'>
export type Guarantor = Tables<'guarantors'>
export type TenantInsert = Omit<TablesInsert<'tenants'>, 'id' | 'project_id' | 'created_at' | 'updated_at'>

export interface TenantWithProperty extends Tenant {
  current_property?: string | null
}

export interface GuarantorForm {
  id?: string
  full_name: string
  contact_info: string
  notes: string
}

export function useInquilinos() {
  const { projectId, loading: projectLoading } = useProjectId()
  const [inquilinos, setInquilinos] = useState<TenantWithProperty[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInquilinos = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    // Fetch tenants
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('project_id', projectId)
      .order('full_name')
    if (error) throw error

    // Fetch active contracts with property info
    const { data: contracts } = await supabase
      .from('contracts')
      .select('tenant_id, property_id')
      .eq('project_id', projectId)
      .eq('is_active', true)

    const { data: properties } = await supabase
      .from('properties')
      .select('id, full_address')
      .eq('project_id', projectId)

    const propMap = new Map(properties?.map(p => [p.id, p.full_address]) ?? [])
    const tenantPropMap = new Map<string, string>()
    contracts?.forEach(c => {
      const addr = propMap.get(c.property_id)
      if (addr) tenantPropMap.set(c.tenant_id, addr)
    })

    const enriched: TenantWithProperty[] = (tenants ?? []).map(t => ({
      ...t,
      current_property: tenantPropMap.get(t.id) ?? null,
    }))

    setInquilinos(enriched)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!projectLoading && projectId) {
      fetchInquilinos()
    } else if (!projectLoading) {
      setLoading(false)
    }
  }, [projectId, projectLoading, fetchInquilinos])

  const crearInquilino = async (data: TenantInsert, guarantors: GuarantorForm[]) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { data: created, error } = await supabase
      .from('tenants')
      .insert({ ...data, project_id: projectId })
      .select('id')
      .single()
    if (error) throw error
    if (guarantors.length > 0) {
      const { error: gError } = await supabase
        .from('guarantors')
        .insert(guarantors.map(g => ({
          full_name: g.full_name,
          contact_info: g.contact_info || null,
          notes: g.notes || null,
          tenant_id: created.id,
          project_id: projectId,
        })))
      if (gError) throw gError
    }
    await fetchInquilinos()
  }

  const editarInquilino = async (id: string, data: Partial<TenantInsert>, guarantors: GuarantorForm[]) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase
      .from('tenants')
      .update(data)
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) throw error

    // Delete existing guarantors and re-insert
    await supabase.from('guarantors').delete().eq('tenant_id', id).eq('project_id', projectId)
    if (guarantors.length > 0) {
      const { error: gError } = await supabase
        .from('guarantors')
        .insert(guarantors.map(g => ({
          full_name: g.full_name,
          contact_info: g.contact_info || null,
          notes: g.notes || null,
          tenant_id: id,
          project_id: projectId,
        })))
      if (gError) throw gError
    }
    await fetchInquilinos()
  }

  const eliminarInquilino = async (id: string) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    // Delete guarantors first, then tenant
    await supabase.from('guarantors').delete().eq('tenant_id', id).eq('project_id', projectId)
    const { error } = await supabase.from('tenants').delete().eq('id', id).eq('project_id', projectId)
    if (error) throw error
    await fetchInquilinos()
  }

  const fetchGuarantors = async (tenantId: string): Promise<Guarantor[]> => {
    if (!projectId) return []
    const { data } = await supabase
      .from('guarantors')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
    return data ?? []
  }

  const fetchContracts = async (tenantId: string) => {
    if (!projectId) return []
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, property_id, start_date, end_date, current_rent, currency, is_active')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('start_date', { ascending: false })

    const { data: properties } = await supabase
      .from('properties')
      .select('id, full_address')
      .eq('project_id', projectId)

    const propMap = new Map(properties?.map(p => [p.id, p.full_address]) ?? [])
    return (contracts ?? []).map(c => ({
      ...c,
      property_address: propMap.get(c.property_id) ?? '—',
    }))
  }

  const hasAnyContract = async (tenantId: string): Promise<boolean> => {
    if (!projectId) return false
    const { count } = await supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
    return (count ?? 0) > 0
  }

  return {
    inquilinos,
    loading: loading || projectLoading,
    crearInquilino,
    editarInquilino,
    eliminarInquilino,
    fetchGuarantors,
    fetchContracts,
    hasAnyContract,
  }
}
