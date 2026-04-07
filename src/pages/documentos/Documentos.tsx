import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FolderOpen, FileText, Eye, Download, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocumentos, type EnrichedDocument } from '@/hooks/useDocumentos'
import { usePropiedades } from '@/hooks/usePropiedades'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import { formatDate } from '@/lib/utils'
import DocumentoUpload from '@/components/documentos/DocumentoUpload'

export default function Documentos() {
  const { t } = useTranslation()
  const { documentos, loading, subirDocumento, eliminarDocumento } = useDocumentos()
  const { propiedades } = usePropiedades()
  const { projectId } = useProjectId()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterProperty, setFilterProperty] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<EnrichedDocument | null>(null)

  // Fetch contracts for the upload form
  const [contracts, setContracts] = useState<{ id: string; tenant_name: string; property_address: string }[]>([])
  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      const { data: contractsData } = await supabase.from('contracts').select('id, tenant_id, property_id').eq('project_id', projectId).eq('is_active', true)
      if (!contractsData?.length) return

      const tenantIds = [...new Set(contractsData.map(c => c.tenant_id))]
      const propertyIds = [...new Set(contractsData.map(c => c.property_id))]

      const [tenantsRes, propsRes] = await Promise.all([
        supabase.from('tenants').select('id, full_name').in('id', tenantIds),
        supabase.from('properties').select('id, full_address').in('id', propertyIds),
      ])

      const tMap = new Map((tenantsRes.data ?? []).map(t => [t.id, t.full_name]))
      const pMap = new Map((propsRes.data ?? []).map(p => [p.id, p.full_address]))

      setContracts(contractsData.map(c => ({
        id: c.id,
        tenant_name: tMap.get(c.tenant_id) ?? '—',
        property_address: pMap.get(c.property_id) ?? '—',
      })))
    }
    load()
  }, [projectId])

  // Filters
  const filtered = useMemo(() => {
    let result = documentos
    if (filterType !== 'all') result = result.filter(d => d.doc_type === filterType)
    if (filterProperty !== 'all') result = result.filter(d => d.property_id === filterProperty)
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(d =>
        d.title.toLowerCase().includes(s) ||
        (d.file_name?.toLowerCase().includes(s)) ||
        (d.property_address?.toLowerCase().includes(s))
      )
    }
    return result
  }, [documentos, filterType, filterProperty, search])

  // Group by scope
  const byProperty = filtered.filter(d => d.scope === 'property')
  const byContract = filtered.filter(d => d.scope === 'contract')
  const byProject = filtered.filter(d => d.scope === 'project')

  // Summary
  const totalDocs = documentos.length
  const propDocs = documentos.filter(d => d.scope === 'property').length
  const contractDocs = documentos.filter(d => d.scope === 'contract').length

  const handleView = async (doc: EnrichedDocument) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_url, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const handleDownload = async (doc: EnrichedDocument) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_url, 120)
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = doc.file_name ?? doc.title
      a.click()
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await eliminarDocumento(deleteTarget.id, deleteTarget.file_url)
      toast.success(t('docs.toast.deleted'))
    } catch {
      toast.error(t('docs.toast.deleteError'))
    }
    setDeleteTarget(null)
  }

  const docTypeBadgeVariant = (dt: string): 'default' | 'secondary' | 'success' | 'warning' => {
    if (dt === 'contract') return 'default'
    if (dt === 'deed') return 'success'
    if (dt === 'insurance' || dt === 'tax') return 'warning'
    return 'secondary'
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const renderSection = (title: string, docs: EnrichedDocument[]) => {
    if (docs.length === 0) return null
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('docs.columns.title')}</TableHead>
                <TableHead>{t('docs.columns.type')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('docs.columns.reference')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('docs.columns.date')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('docs.columns.size')}</TableHead>
                <TableHead className="text-right">{t('docs.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(d => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate max-w-[200px]">{d.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={docTypeBadgeVariant(d.doc_type)}>
                      {t(`docs.docTypes.${d.doc_type}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {d.property_address ?? d.tenant_name ?? t('docs.scopes.project')}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{formatDate(d.created_at)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{formatSize(d.file_size)}</TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" onClick={() => handleView(d)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('docs.actions.view')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" onClick={() => handleDownload(d)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('docs.actions.download')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(d)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('docs.actions.delete')}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('docs.title')}</h2>
          <p className="text-muted-foreground">{t('docs.subtitle')}</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />{t('docs.upload.btn')}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('docs.summary.total')}</p>
            <p className="text-2xl font-bold">{totalDocs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('docs.summary.byProperty')}</p>
            <p className="text-2xl font-bold">{propDocs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('docs.summary.byContract')}</p>
            <p className="text-2xl font-bold">{contractDocs}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('docs.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('docs.filters.allTypes')}</SelectItem>
            {['contract', 'deed', 'regulation', 'floor_plan', 'insurance', 'tax', 'receipt', 'id_document', 'other'].map(dt => (
              <SelectItem key={dt} value={dt}>{t(`docs.docTypes.${dt}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('docs.filters.allProperties')}</SelectItem>
            {propiedades.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.full_address}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">{t('docs.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('docs.emptyDesc')}</p>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />{t('docs.upload.first')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {renderSection(t('docs.sections.property'), byProperty)}
          {renderSection(t('docs.sections.contract'), byContract)}
          {renderSection(t('docs.sections.project'), byProject)}
        </div>
      )}

      {/* Upload sheet */}
      <DocumentoUpload
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        properties={propiedades.map(p => ({ id: p.id, full_address: p.full_address }))}
        contracts={contracts}
        onSubmit={subirDocumento}
      />

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('docs.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('docs.delete.desc', { name: deleteTarget?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('docs.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
