import { Plus, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const resumen = [
  { label: 'Cobrado este mes', valor: '$ —', variant: 'success' as const },
  { label: 'Pendiente', valor: '$ —', variant: 'warning' as const },
  { label: 'Atrasado', valor: '$ —', variant: 'destructive' as const },
]

export default function Cobranza() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cobranza</h2>
          <p className="text-muted-foreground">Seguimiento de pagos y alquileres</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Registrar pago
        </Button>
      </div>

      {/* Resumen financiero */}
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

      {/* Tabla vacia */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold mb-1">Sin movimientos registrados</h3>
          <p className="text-sm text-muted-foreground">
            Los pagos aparecerán aquí una vez que tengas contratos activos
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
