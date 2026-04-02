import { Plus, Users, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Inquilinos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inquilinos</h2>
          <p className="text-muted-foreground">Administrá los inquilinos y sus contratos</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nuevo inquilino
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar inquilino..."
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold mb-1">Sin inquilinos registrados</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Agregá inquilinos y asocialos a tus propiedades
          </p>
          <Button>
            <Plus className="h-4 w-4" />
            Agregar inquilino
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
