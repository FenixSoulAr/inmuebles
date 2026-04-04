import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types'

export type Propiedad = Tables<'properties'>
export type PropiedadInsert = Omit<TablesInsert<'properties'>, 'id' | 'project_id' | 'created_at' | 'updated_at'>
export type PropiedadUpdate = Omit<TablesUpdate<'properties'>, 'id' | 'project_id' | 'created_at' | 'updated_at'>

export function usePropiedades() {
  const { projectId, loading: projectLoading } = useProjectId()
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPropiedades = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (error) throw error
    setPropiedades(data ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!projectLoading && projectId) {
      fetchPropiedades()
    } else if (!projectLoading) {
      setLoading(false)
    }
  }, [projectId, projectLoading, fetchPropiedades])

  const crearPropiedad = async (data: PropiedadInsert) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase
      .from('properties')
      .insert({ ...data, project_id: projectId })
    if (error) throw error
    await fetchPropiedades()
  }

  const editarPropiedad = async (id: string, data: PropiedadUpdate) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase
      .from('properties')
      .update(data)
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) throw error
    await fetchPropiedades()
  }

  const eliminarPropiedad = async (id: string) => {
    if (!projectId) throw new Error('Sin proyecto activo')
    const { error } = await supabase
      .from('properties')
      .update({ active: false })
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) throw error
    await fetchPropiedades()
  }

  return { propiedades, loading: loading || projectLoading, crearPropiedad, editarPropiedad, eliminarPropiedad }
}
