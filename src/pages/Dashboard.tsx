import { Building2, Users, CreditCard, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const estadisticas = [
  {
    titulo: 'Propiedades',
    valor: '—',
    descripcion: 'Total registradas',
    icon: Building2,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    titulo: 'Inquilinos activos',
    valor: '—',
    descripcion: 'Con contrato vigente',
    icon: Users,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    titulo: 'Cobros pendientes',
    valor: '—',
    descripcion: 'Este mes',
    icon: CreditCard,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
  {
    titulo: 'Reparaciones',
    valor: '—',
    descripcion: 'En curso',
    icon: Wrench,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bienvenido a MyRentaHub</h2>
        <p className="text-muted-foreground">
          Resumen general de tu cartera de propiedades
        </p>
      </div>

      {/* Tarjetas de estadisticas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {estadisticas.map(({ titulo, valor, descripcion, icon: Icon, color, bg }) => (
          <Card key={titulo}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {titulo}
              </CardTitle>
              <div className={`rounded-md p-2 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{valor}</div>
              <p className="text-xs text-muted-foreground mt-1">{descripcion}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actividad reciente */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proximos vencimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CreditCard className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No hay vencimientos proximos
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reparaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Wrench className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Sin reparaciones pendientes
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado de propiedades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de propiedades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Aun no cargaste propiedades
            </p>
            <div className="flex gap-2">
              <Badge variant="success">Alquilada</Badge>
              <Badge variant="secondary">Disponible</Badge>
              <Badge variant="warning">En reparacion</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
