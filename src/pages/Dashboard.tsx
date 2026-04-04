import { useEffect, useState } from 'react'
import { Building2, Users, CreditCard, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'

export default function Dashboard() {
  const { projectId, loading: loadingProject } = useProjectId()
  const [stats, setStats] = useState({ properties: 0, tenants: 0, pendingDues: 0, repairs: 0 })
  const [upcomingDues, setUpcomingDues] = useState<any[]>([])
  const [pendingRepairs, setPendingRepairs] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return

    const load = async () => {
      const [propRes, tenantRes, duesRes, repairRes, upcomingRes, pendRepRes] = await Promise.all([
        supabase.from('properties').select('id, full_address, status, internal_identifier', { count: 'exact' }).eq('project_id', projectId).eq('active', true),
        supabase.from('tenants').select('id', { count: 'exact' }).eq('project_id', projectId).eq('status', 'active'),
        supabase.from('rent_dues').select('id', { count: 'exact' }).eq('project_id', projectId).in('status', ['overdue', 'pending']),
        supabase.from('maintenance_issues').select('id', { count: 'exact' }).eq('project_id', projectId).in('status', ['pending', 'in_progress']),
        supabase.from('rent_dues').select('id, period_month, due_date, expected_amount, status, tenants(full_name), properties(internal_identifier)').eq('project_id', projectId).gte('due_date', new Date().toISOString().slice(0, 10)).order('due_date').limit(5),
        supabase.from('maintenance_issues').select('id, description, status, reported_at, properties(internal_identifier)').eq('project_id', projectId).in('status', ['pending', 'in_progress']).order('reported_at', { ascending: false }).limit(5),
      ])

      setStats({
        properties: propRes.count ?? 0,
        tenants: tenantRes.count ?? 0,
        pendingDues: duesRes.count ?? 0,
        repairs: repairRes.count ?? 0,
      })
      setProperties(propRes.data ?? [])
      setUpcomingDues(upcomingRes.data ?? [])
      setPendingRepairs(pendRepRes.data ?? [])
      setLoading(false)
    }

    load()
  }, [projectId])

  if (loadingProject || loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Cargando dashboard…</div>
  }

  const estadisticas = [
    { titulo: 'Propiedades', valor: stats.properties, descripcion: 'Total registradas', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { titulo: 'Inquilinos activos', valor: stats.tenants, descripcion: 'Con contrato vigente', icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { titulo: 'Cobros pendientes', valor: stats.pendingDues, descripcion: 'Este mes', icon: CreditCard, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { titulo: 'Reparaciones', valor: stats.repairs, descripcion: 'En curso', icon: Wrench, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bienvenido a MyRentaHub</h2>
        <p className="text-muted-foreground">Resumen general de tu cartera de propiedades</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {estadisticas.map(({ titulo, valor, descripcion, icon: Icon, color, bg }) => (
          <Card key={titulo}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
              <div className={`rounded-md p-2 ${bg}`}><Icon className={`h-4 w-4 ${color}`} /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{valor}</div>
              <p className="text-xs text-muted-foreground mt-1">{descripcion}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Próximos vencimientos</CardTitle></CardHeader>
          <CardContent>
            {upcomingDues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No hay vencimientos próximos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDues.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{(d.tenants as any)?.full_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{(d.properties as any)?.internal_identifier} · {d.period_month}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">$ {Number(d.expected_amount).toLocaleString('es-AR')}</p>
                      <p className="text-xs text-muted-foreground">{d.due_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Reparaciones pendientes</CardTitle></CardHeader>
          <CardContent>
            {pendingRepairs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Wrench className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Sin reparaciones pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRepairs.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{r.description}</p>
                      <p className="text-xs text-muted-foreground">{(r.properties as any)?.internal_identifier}</p>
                    </div>
                    <Badge variant={r.status === 'pending' ? 'warning' : 'secondary'}>{r.status === 'pending' ? 'Pendiente' : 'En progreso'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Estado de propiedades</CardTitle></CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Aún no cargaste propiedades</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium text-sm">{p.internal_identifier}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.full_address}</p>
                  </div>
                  <Badge variant={p.status === 'rented' ? 'success' : p.status === 'vacant' ? 'secondary' : 'warning'}>
                    {p.status === 'rented' ? 'Alquilada' : p.status === 'vacant' ? 'Disponible' : 'En reparación'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
