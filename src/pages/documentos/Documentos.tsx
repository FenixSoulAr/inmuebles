import { useEffect, useState } from 'react'
import { Upload, FolderOpen, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'

export default function Documentos() {
  const { projectId } = useProjectId()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      const { data } = await supabase
        .from('documents')
        .select('*, properties(internal_identifier)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      setDocs(data ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Documentos</h2>
          <p className="text-muted-foreground">Contratos, escrituras y archivos adjuntos</p>
        </div>
        <Button><Upload className="h-4 w-4" />Subir documento</Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando documentos…</div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">Sin documentos cargados</h3>
            <p className="text-sm text-muted-foreground mb-4">Subí contratos, escrituras y otros documentos relacionados a tus propiedades</p>
            <Button><Upload className="h-4 w-4" />Subir primer documento</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map(d => (
            <Card key={d.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.doc_type} · {d.scope}</p>
                    {(d.properties as any)?.internal_identifier && (
                      <p className="text-xs text-muted-foreground">{(d.properties as any).internal_identifier}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
