import { Plus, Building2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Propiedades() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Propiedades</h2>
          <p className="text-muted-foreground">Gestioná tu cartera de inmuebles</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nueva propiedad
        </Button>
      </div>

      {/* Barra de busqueda y filtros — proxima iteracion */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar propiedad..."
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Lista vacia */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold mb-1">Sin propiedades registradas</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Comenzá agregando tu primera propiedad
          </p>
          <Button>
            <Plus className="h-4 w-4" />
            Agregar propiedad
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
