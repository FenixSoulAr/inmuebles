import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import { useAuth } from '@/contexts/AuthContext'
import type { Tables } from '@/integrations/supabase/types'

export type Document = Tables<'documents'>

export interface EnrichedDocument extends Document {
  property_address: string | null
  tenant_name: string | null
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)
}

const DOC_TYPE_LABELS_ES: Record<string, string> = {
  contract: 'Contrato',
  deed: 'Escritura',
  regulation: 'Reglamento',
  floor_plan: 'Plano',
  insurance: 'Seguro',
  tax: 'Impuesto',
  receipt: 'Comprobante',
  id_document: 'Documento identidad',
  other: 'Otro',
}

export function generateNaming(opts: {
  docType: string
  scope: string
  reference: string
  fileExtension: string
}) {
  const { docType, reference, fileExtension } = opts
  const now = new Date()
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const monthYear = `${monthNames[now.getMonth()]} ${now.getFullYear()}`
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const typeLabel = DOC_TYPE_LABELS_ES[docType] || docType
  const refTruncated = reference.substring(0, 25)

  const title = `${typeLabel} - ${refTruncated} - ${monthYear}`

  const slug = toSlug(reference)
  const typeSlug = toSlug(typeLabel)
  const fileName = `${slug}_${typeSlug}_${yearMonth}.${fileExtension}`

  return { title, fileName }
}

export function useDocumentos() {
  const { projectId, loading: projectLoading } = useProjectId()
  const { user } = useAuth()
  const [documentos, setDocumentos] = useState<EnrichedDocument[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDocumentos = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const [docsRes, propsRes, contractsRes] = await Promise.all([
      supabase.from('documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('properties').select('id, full_address').eq('project_id', projectId),
      supabase.from('contracts').select('id, tenant_id').eq('project_id', projectId),
    ])

    const propMap = new Map((propsRes.data ?? []).map(p => [p.id, p.full_address]))

    // Get tenant names for contracts
    const tenantIds = [...new Set((contractsRes.data ?? []).map(c => c.tenant_id))]
    let tenantMap = new Map<string, string>()
    if (tenantIds.length > 0) {
      const { data: tenants } = await supabase.from('tenants').select('id, full_name').in('id', tenantIds)
      tenantMap = new Map((tenants ?? []).map(t => [t.id, t.full_name]))
    }

    const contractTenantMap = new Map(
      (contractsRes.data ?? []).map(c => [c.id, tenantMap.get(c.tenant_id) ?? null])
    )

    const enriched: EnrichedDocument[] = (docsRes.data ?? []).map(d => ({
      ...d,
      property_address: d.property_id ? propMap.get(d.property_id) ?? null : null,
      tenant_name: d.contract_id ? contractTenantMap.get(d.contract_id) ?? null : null,
    }))

    setDocumentos(enriched)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!projectLoading && projectId) {
      fetchDocumentos()
    } else if (!projectLoading) {
      setLoading(false)
    }
  }, [projectId, projectLoading, fetchDocumentos])

  const subirDocumento = async (
    file: File,
    metadata: {
      title: string
      doc_type: string
      scope: string
      property_id?: string | null
      contract_id?: string | null
      file_name: string
      notes?: string | null
    }
  ) => {
    if (!projectId || !user) throw new Error('Sin proyecto activo')

    const storagePath = `${projectId}/${metadata.scope}/${metadata.file_name}`

    // Read file as ArrayBuffer for mobile stability
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })
    if (uploadError) throw uploadError

    const { error: insertError } = await supabase.from('documents').insert({
      project_id: projectId,
      title: metadata.title,
      doc_type: metadata.doc_type,
      scope: metadata.scope,
      property_id: metadata.property_id || null,
      contract_id: metadata.contract_id || null,
      file_url: storagePath,
      file_name: metadata.file_name,
      file_size: file.size,
      mime_type: file.type,
      notes: metadata.notes || null,
      created_by: user.id,
    })
    if (insertError) throw insertError

    await fetchDocumentos()
  }

  const eliminarDocumento = async (id: string, fileUrl: string) => {
    if (!projectId) throw new Error('Sin proyecto activo')

    // Delete from storage
    await supabase.storage.from('documents').remove([fileUrl])

    // Delete from table
    const { error } = await supabase.from('documents')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
    if (error) throw error

    await fetchDocumentos()
  }

  return { documentos, loading: loading || projectLoading, fetchDocumentos, subirDocumento, eliminarDocumento, projectId }
}
