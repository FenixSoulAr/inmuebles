import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { generateNaming } from '@/hooks/useDocumentos'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  properties: { id: string; full_address: string }[]
  contracts: { id: string; tenant_name: string; property_address: string }[]
  onSubmit: (file: File, metadata: {
    title: string
    doc_type: string
    scope: string
    property_id?: string | null
    contract_id?: string | null
    file_name: string
    notes?: string | null
  }) => Promise<void>
}

const DOC_TYPES = [
  'contract', 'deed', 'regulation', 'floor_plan',
  'insurance', 'tax', 'receipt', 'id_document', 'other',
] as const

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.docx'
const MAX_SIZE = 10 * 1024 * 1024

export default function DocumentoUpload({ open, onOpenChange, properties, contracts, onSubmit }: Props) {
  const { t } = useTranslation()
  const [docType, setDocType] = useState<string>('other')
  const [scope, setScope] = useState<string>('property')
  const [propertyId, setPropertyId] = useState<string>('')
  const [contractId, setContractId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const reference = useMemo(() => {
    if (scope === 'property' && propertyId) {
      return properties.find(p => p.id === propertyId)?.full_address ?? 'Propiedad'
    }
    if (scope === 'contract' && contractId) {
      return contracts.find(c => c.id === contractId)?.tenant_name ?? 'Contrato'
    }
    return 'Proyecto'
  }, [scope, propertyId, contractId, properties, contracts])

  const fileExt = file ? (file.name.split('.').pop()?.toLowerCase() ?? 'pdf') : 'pdf'

  const naming = useMemo(
    () => generateNaming({ docType, scope, reference, fileExtension: fileExt }),
    [docType, scope, reference, fileExt]
  )

  const [customTitle, setCustomTitle] = useState('')
  const effectiveTitle = customTitle || naming.title

  // Regenerate file_name from effective title
  const effectiveFileName = useMemo(() => {
    if (customTitle) {
      return generateNaming({ docType, scope, reference: customTitle, fileExtension: fileExt }).fileName
    }
    return naming.fileName
  }, [customTitle, docType, scope, fileExt, naming.fileName, reference])

  const canSubmit = docType && scope && file &&
    (scope === 'project' || (scope === 'property' && propertyId) || (scope === 'contract' && contractId))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_SIZE) {
      toast.error(t('docs.toast.tooLarge'))
      return
    }
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!canSubmit || !file) return
    setSaving(true)
    try {
      await onSubmit(file, {
        title: effectiveTitle,
        doc_type: docType,
        scope,
        property_id: scope === 'property' ? propertyId : null,
        contract_id: scope === 'contract' ? contractId : null,
        file_name: effectiveFileName,
        notes: notes || null,
      })
      toast.success(`${t('docs.toast.uploaded')}: ${effectiveTitle}`)
      resetForm()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || t('docs.toast.uploadError'))
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setDocType('other')
    setScope('property')
    setPropertyId('')
    setContractId('')
    setFile(null)
    setNotes('')
    setCustomTitle('')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('docs.upload.title')}</SheetTitle>
          <SheetDescription>{t('docs.upload.desc')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Step 1: Classification */}
          <div className="space-y-3">
            <Label>{t('docs.upload.docType')}</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(dt => (
                  <SelectItem key={dt} value={dt}>{t(`docs.docTypes.${dt}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label>{t('docs.upload.scope')}</Label>
            <Select value={scope} onValueChange={v => { setScope(v); setPropertyId(''); setContractId('') }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="property">{t('docs.scopes.property')}</SelectItem>
                <SelectItem value="contract">{t('docs.scopes.contract')}</SelectItem>
                <SelectItem value="project">{t('docs.scopes.project')}</SelectItem>
              </SelectContent>
            </Select>

            {scope === 'property' && (
              <>
                <Label>{t('docs.upload.property')}</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger><SelectValue placeholder={t('docs.upload.selectProperty')} /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {scope === 'contract' && (
              <>
                <Label>{t('docs.upload.contract')}</Label>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger><SelectValue placeholder={t('docs.upload.selectContract')} /></SelectTrigger>
                  <SelectContent>
                    {contracts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.tenant_name} — {c.property_address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Step 2: Naming preview */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm text-primary">
              <FileText className="h-4 w-4" />
              {t('docs.upload.previewLabel')}
            </div>
            <p className="font-semibold text-sm">{effectiveTitle}</p>
            <p className="text-xs text-muted-foreground">{effectiveFileName}</p>
          </div>

          <div className="space-y-1">
            <Label>{t('docs.upload.customTitle')}</Label>
            <Input
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder={naming.title}
            />
          </div>

          {/* Step 3: File upload */}
          <div className="space-y-1">
            <Label>{t('docs.upload.file')}</Label>
            <Input
              type="file"
              accept={ACCEPTED}
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>{t('docs.upload.notes')}</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('docs.upload.notesPlaceholder')}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {saving ? t('common.saving') : t('docs.upload.submit')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
