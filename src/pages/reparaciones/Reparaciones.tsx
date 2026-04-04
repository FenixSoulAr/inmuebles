import { useEffect, useState } from 'react'
import { Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'

const filtros = ['Todas', 'Pendiente', 'En progreso', 'Completada']
const filterMap: Record<string, string | null> = { Todas: null, Pendiente: 'pending', 'En progreso': 'in_progress', Completada: 'completed' }

export default function Reparaciones() {
  const { projectId } = useProjectId()
  const [issues, setIssues] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('Todas')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      const { data } = await supabase
        .from('maintenance_issues')
        .select('*, properties(internal_identifier)')
        .eq('project_id', projectId)
        .order('reported_at', { ascending: false })
      setIssues(data ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  const filtered = activeFilter === 'Todas' ? issues : issues.filter(i => i.status === filterMap[activeFilter])
  const statusLabel: Record<string, string> = { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completada' }
  const statusVariant: Record<string, 'warning' | 'secondary' | 'success'> = { pending: 'warning', in_progress: 'secondary', completed: 'success' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reparaciones</h2>
          <p className="text-muted-foreground">Control de mantenimiento y arreglos</p>
        </div>
        <Button><Plus className="h-4 w-4" />Nueva reparación</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filtros.map(f => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${f === activeFilter ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando reparaciones…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">Sin reparaciones registradas</h3>
            <p className="text-sm text-muted-foreground mb-4">Registrá incidencias de mantenimiento para hacerles seguimiento</p>
            <Button><Plus className="h-4 w-4" />Registrar reparación</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(r => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{r.description}</p>
                    <p className="text-xs text-muted-foreground">{(r.properties as any)?.internal_identifier}</p>
                  </div>
                  <Badge variant={statusVariant[r.status] ?? 'secondary'}>{statusLabel[r.status] ?? r.status}</Badge>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Solicitó: {r.requested_by}</span>
                  <span>Paga: {r.payer}</span>
                  {r.estimate_amount && <span>Estimado: $ {Number(r.estimate_amount).toLocaleString('es-AR')}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
