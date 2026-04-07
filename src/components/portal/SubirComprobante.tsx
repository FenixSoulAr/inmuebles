import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'

interface RentDue {
  id: string
  due_date: string
  expected_amount: number
  balance_due: number
  status: string
  period_month: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  due: RentDue
  contractId: string
  projectId: string
  onSuccess: () => void
}

const ACCEPTED = '.jpg,.jpeg,.png,.pdf,.webp'
const MAX_SIZE = 10 * 1024 * 1024

export default function SubirComprobante({ open, onOpenChange, due, contractId, projectId, onSuccess }: Props) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [amount, setAmount] = useState(String(due.balance_due))
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().split('T')[0])
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_SIZE) {
      toast.error(t('portal.proof.tooLarge'))
      return
    }
    setFile(f)
  }

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      toast.error(t('portal.proof.invalidAmount'))
      return
    }
    if (!file) {
      toast.error(t('portal.proof.noFile'))
      return
    }

    setSubmitting(true)
    try {
      // Upload file using ArrayBuffer for mobile stability
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const timestamp = Date.now()
      const storagePath = `${contractId}/${due.period_month}_${timestamp}.${ext}`

      const arrayBuffer = await file.arrayBuffer()
      const { error: uploadError } = await supabase.storage
        .from('proof-files')
        .upload(storagePath, arrayBuffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Insert payment proof
      const { error: insertError } = await supabase
        .from('payment_proofs')
        .insert({
          project_id: projectId,
          contract_id: contractId,
          obligation_id: due.id,
          type: 'rent',
          period: due.period_month,
          amount: numAmount,
          paid_at: paidAt,
          files: [storagePath],
          status: 'pending',
          proof_status: 'pending',
          comment: comment.trim() || null,
        })

      if (insertError) throw insertError

      toast.success(t('portal.proof.sent'))
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error(t('portal.proof.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:max-w-lg sm:mx-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {t('portal.proof.title')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Period (read-only) */}
          <div>
            <Label>{t('portal.proof.period')}</Label>
            <Input value={due.period_month} disabled />
          </div>

          {/* Amount */}
          <div>
            <Label>{t('portal.proof.amount')}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          {/* Date */}
          <div>
            <Label>{t('portal.proof.date')}</Label>
            <Input
              type="date"
              value={paidAt}
              onChange={e => setPaidAt(e.target.value)}
            />
          </div>

          {/* Comment */}
          <div>
            <Label>{t('portal.proof.comment')}</Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('portal.proof.commentPlaceholder')}
              rows={2}
            />
          </div>

          {/* File */}
          <div>
            <Label>{t('portal.proof.file')}</Label>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="h-4 w-4" />
              {file ? file.name : t('portal.proof.selectFile')}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">{t('portal.proof.fileHint')}</p>
          </div>

          {/* Expected info */}
          <div className="rounded-md bg-muted/50 border p-3 text-sm">
            <span className="text-muted-foreground">{t('portal.proof.expectedLabel')}: </span>
            <span className="font-semibold">{formatCurrency(due.balance_due)}</span>
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !file}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {t('portal.proof.submit')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
