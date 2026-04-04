import { useEffect, useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'

export default function Impuestos() {
  const { projectId } = useProjectId()
  const [taxes, setTaxes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      const { data } = await supabase
        .from('tax_obligations')
        .select('*, properties(internal_identifier)')
        .eq('project_id', projectId)
        .order('due_date', { ascending: false })
      setTaxes(data ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  const statusLabel: Record<string, string> = { pending: 'Pendiente', paid: 'Pagado', overdue: 'Vencido' }
  const statusVariant: Record<string, 'warning' | 'success' | 'destructive'> = { pending: 'warning', paid: 'success', overdue: 'destructive' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Impuestos</h2>
          <p className="text-muted-foreground">ABL, Ingresos Brutos y otros gravámenes</p>
        </div>
        <Button><Plus className="h-4 w-4" />Nuevo impuesto</Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando impuestos…</div>
      ) : taxes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">Sin impuestos registrados</h3>
            <p className="text-sm text-muted-foreground mb-4">Cargá los impuestos de cada propiedad para controlar sus vencimientos</p>
            <Button><Plus className="h-4 w-4" />Agregar impuesto</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {taxes.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{t.type}</p>
                    <p className="text-xs text-muted-foreground">{(t.properties as any)?.internal_identifier}</p>
                  </div>
                  <Badge variant={statusVariant[t.status] ?? 'secondary'}>{statusLabel[t.status] ?? t.status}</Badge>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Vence: {t.due_date}</span>
                  <span>Responsable: {t.responsible}</span>
                  {t.amount && <span>$ {Number(t.amount).toLocaleString('es-AR')}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
