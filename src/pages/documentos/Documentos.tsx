import { Upload, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Documentos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Documentos</h2>
          <p className="text-muted-foreground">Contratos, escrituras y archivos adjuntos</p>
        </div>
        <Button>
          <Upload className="h-4 w-4" />
          Subir documento
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold mb-1">Sin documentos cargados</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Subí contratos, escrituras y otros documentos relacionados a tus propiedades
          </p>
          <Button>
            <Upload className="h-4 w-4" />
            Subir primer documento
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
