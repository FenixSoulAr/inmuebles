import { Download, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const tiposReporte = [
  {
    titulo: 'Cobranza mensual',
    descripcion: 'Resumen de pagos recibidos y pendientes por mes',
    icono: '💰',
  },
  {
    titulo: 'Rentabilidad por propiedad',
    descripcion: 'Ingresos vs. gastos (impuestos + reparaciones) por inmueble',
    icono: '📊',
  },
  {
    titulo: 'Ocupacion de propiedades',
    descripcion: 'Porcentaje de ocupacion y periodos vacantes',
    icono: '🏠',
  },
  {
    titulo: 'Historial de reparaciones',
    descripcion: 'Detalle de mantenimientos y costos asociados',
    icono: '🔧',
  },
]

export default function Reportes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reportes</h2>
          <p className="text-muted-foreground">Exporta informes de tu cartera en PDF o Excel</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tiposReporte.map(({ titulo, descripcion, icono }) => (
          <Card key={titulo} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{icono}</span>
                    {titulo}
                  </CardTitle>
                  <CardDescription className="mt-1">{descripcion}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" disabled>
                  <Download className="h-3.5 w-3.5" />
                  Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder grafico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos mensuales</CardTitle>
          <CardDescription>Evolucion de cobros de los ultimos 12 meses</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            El grafico se mostrara cuando haya datos registrados
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
