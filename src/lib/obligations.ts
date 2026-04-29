import { supabase } from '@/integrations/supabase/client'

/**
 * Resuelve el ID de la obligation espejo (kind='rent') para un rent_due.
 * Si no existe, la crea. Devuelve el obligation.id.
 */
export async function resolveRentObligationId(params: {
  projectId: string
  contractId: string
  propertyId: string
  tenantId: string
  periodMonth: string
  dueDate: string
  expectedAmount: number
  currency: string
}): Promise<string | null> {
  const {
    projectId,
    contractId,
    propertyId,
    tenantId,
    periodMonth,
    dueDate,
    expectedAmount,
    currency,
  } = params

  // 1. Buscar existente
  const { data: existing, error: selErr } = await supabase
    .from('obligations')
    .select('id')
    .eq('contract_id', contractId)
    .eq('period', periodMonth)
    .eq('kind', 'rent')
    .maybeSingle()

  if (selErr) {
    console.error('resolveRentObligationId select error:', selErr)
    return null
  }
  if (existing) return existing.id

  // 2. Crear si no existe
  const { data: created, error } = await supabase
    .from('obligations')
    .insert({
      project_id: projectId,
      property_id: propertyId,
      contract_id: contractId,
      tenant_id: tenantId,
      kind: 'rent',
      period: periodMonth,
      due_date: dueDate,
      expected_amount: expectedAmount,
      currency,
      status: 'upcoming',
    })
    .select('id')
    .single()

  if (error) {
    console.error('resolveRentObligationId insert error:', error)
    return null
  }
  return created.id
}
