import { useEffect, useState } from 'react'
import { Plus, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'

export default function Cobranza() {
  const { projectId } = useProjectId()
  const [dues, setDues] = useState<any[]>([])
  const [summary, setSummary] = useState({ cobrado: 0, pendiente: 0, atrasado: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      const { data } = await supabase
        .from('rent_dues')
        .select('*, tenants(full_name), properties(internal_identifier)')
        .eq('project_id', projectId)
        .order('due_date', { ascending: false })
        .limit(50)

      const items = data ?? []
      setDues(items)

      const cobrado = items.filter(d => d.status === 'paid').reduce((s, d) => s + Number(d.expected_amount), 0)
      const pendiente = items.filter(d => d.status === 'pending').reduce((s, d) => s + Number(d.balance_due), 0)
      const atrasado = items.filter(d => d.status === 'overdue').reduce((s, d) => s + Number(d.balance_due), 0)
      setSummary({ cobrado, pendiente, atrasado })
      setLoading(false)
    }
    load()
  }, [projectId])

  const resumen = [
    { label: 'Cobrado este mes', valor: `$ ${summary.cobrado.toLocaleString('es-AR')}`, variant: 'success' as const },
    { label: 'Pendiente', valor: `$ ${summary.pendiente.toLocaleString('es-AR')}`, variant: 'warning' as const },
    { label: 'Atrasado', valor: `$ ${summary.atrasado.toLocaleString('es-AR')}`, variant: 'destructive' as const },
  ]

  const statusLabel: Record<string, string> = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Atrasado', partial: 'Parcial' }
  const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { paid: 'success', pending: 'warning', overdue: 'destructive', partial: 'secondary' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cobranza</h2>
          <p className="text-muted-foreground">Seguimiento de pagos y alquileres</p>
        </div>
        <Button><Plus className="h-4 w-4" />Registrar pago</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {resumen.map(({ label, valor, variant }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{valor}</span>
                <Badge variant={variant}>{label.split(' ')[0]}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando cobranza…</div>
      ) : dues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">Sin movimientos registrados</h3>
            <p className="text-sm text-muted-foreground">Los pagos aparecerán aquí una vez que tengas contratos activos</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Inquilino</th>
                    <th className="text-left p-3 font-medium">Propiedad</th>
                    <th className="text-left p-3 font-medium">Período</th>
                    <th className="text-right p-3 font-medium">Monto</th>
                    <th className="text-right p-3 font-medium">Saldo</th>
                    <th className="text-center p-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {dues.map(d => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{(d.tenants as any)?.full_name ?? '—'}</td>
                      <td className="p-3">{(d.properties as any)?.internal_identifier ?? '—'}</td>
                      <td className="p-3">{d.period_month}</td>
                      <td className="p-3 text-right">$ {Number(d.expected_amount).toLocaleString('es-AR')}</td>
                      <td className="p-3 text-right">$ {Number(d.balance_due).toLocaleString('es-AR')}</td>
                      <td className="p-3 text-center">
                        <Badge variant={statusVariant[d.status] ?? 'secondary'}>{statusLabel[d.status] ?? d.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
