import { Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const filtros = ['Todas', 'Pendiente', 'En progreso', 'Completada']

export default function Reparaciones() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reparaciones</h2>
          <p className="text-muted-foreground">Control de mantenimiento y arreglos</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nueva reparacion
        </Button>
      </div>

      {/* Filtros por estado */}
      <div className="flex gap-2 flex-wrap">
        {filtros.map((f, i) => (
          <button
            key={f}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              i === 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold mb-1">Sin reparaciones registradas</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Registrá incidencias de mantenimiento para hacerles seguimiento
          </p>
          <div className="flex gap-2 mb-4">
            <Badge variant="warning">Alta prioridad</Badge>
            <Badge variant="secondary">Media</Badge>
            <Badge variant="outline">Baja</Badge>
          </div>
          <Button>
            <Plus className="h-4 w-4" />
            Registrar reparacion
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
