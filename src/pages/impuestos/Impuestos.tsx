import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Impuestos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Impuestos</h2>
          <p className="text-muted-foreground">ABL, Ingresos Brutos y otros gravamenes</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nuevo impuesto
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold mb-1">Sin impuestos registrados</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Cargá los impuestos de cada propiedad para controlar sus vencimientos
          </p>
          <Button>
            <Plus className="h-4 w-4" />
            Agregar impuesto
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
