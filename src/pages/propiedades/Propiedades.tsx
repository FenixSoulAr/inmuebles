import { useEffect, useState } from 'react'
import { Plus, Building2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'

export default function Propiedades() {
  const { projectId } = useProjectId()
  const [properties, setProperties] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      const { data } = await supabase
        .from('properties')
        .select('*')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('created_at', { ascending: false })
      setProperties(data ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  const filtered = properties.filter(p =>
    p.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
    p.full_address.toLowerCase().includes(search.toLowerCase())
  )

  const statusLabel: Record<string, string> = { rented: 'Alquilada', vacant: 'Disponible', maintenance: 'En reparación' }
  const statusVariant: Record<string, 'success' | 'secondary' | 'warning'> = { rented: 'success', vacant: 'secondary', maintenance: 'warning' }
  const typeLabel: Record<string, string> = { apartment: 'Departamento', house: 'Casa', commercial: 'Local', office: 'Oficina' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Propiedades</h2>
          <p className="text-muted-foreground">Gestioná tu cartera de inmuebles</p>
        </div>
        <Button><Plus className="h-4 w-4" />Nueva propiedad</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar propiedad..." value={search} onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando propiedades…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">Sin propiedades registradas</h3>
            <p className="text-sm text-muted-foreground mb-4">Comenzá agregando tu primera propiedad</p>
            <Button><Plus className="h-4 w-4" />Agregar propiedad</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{p.internal_identifier}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel[p.type] ?? p.type}</p>
                  </div>
                  <Badge variant={statusVariant[p.status] ?? 'secondary'}>{statusLabel[p.status] ?? p.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{p.full_address}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
