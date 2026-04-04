import { useEffect, useState } from 'react'
import { Plus, Users, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'

export default function Inquilinos() {
  const { projectId } = useProjectId()
  const [tenants, setTenants] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('project_id', projectId)
        .order('full_name')
      setTenants(data ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  const filtered = tenants.filter(t =>
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inquilinos</h2>
          <p className="text-muted-foreground">Administrá los inquilinos y sus contratos</p>
        </div>
        <Button><Plus className="h-4 w-4" />Nuevo inquilino</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar inquilino..." value={search} onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando inquilinos…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">Sin inquilinos registrados</h3>
            <p className="text-sm text-muted-foreground mb-4">Agregá inquilinos y asocialos a tus propiedades</p>
            <Button><Plus className="h-4 w-4" />Agregar inquilino</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-start justify-between">
                  <p className="font-semibold">{t.full_name}</p>
                  <Badge variant={t.status === 'active' ? 'success' : 'secondary'}>
                    {t.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                {t.email && <p className="text-sm text-muted-foreground">{t.email}</p>}
                {t.phone && <p className="text-sm text-muted-foreground">{t.phone}</p>}
                {t.doc_id && <p className="text-xs text-muted-foreground">DNI: {t.doc_id}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
