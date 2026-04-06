import { useTranslation } from 'react-i18next'
import { AlertTriangle, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { EnrichedIssue } from '@/hooks/useReparaciones'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  issue: EnrichedIssue | null
  onEdit: () => void
  onDelete: () => void
}

const statusVariant: Record<string, 'warning' | 'default' | 'secondary' | 'success'> = {
  pending: 'warning',
  open: 'default',
  in_progress: 'secondary',
  resolved: 'success',
}

const payerVariant: Record<string, 'default' | 'secondary'> = {
  owner: 'default',
  tenant: 'secondary',
}

export default function ReparacionDetail({ open, onOpenChange, issue, onEdit, onDelete }: Props) {
  const { t } = useTranslation()
  if (!issue) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('repairs.detail.title')}</SheetTitle>
          <SheetDescription>{issue.property_address}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t('repairs.columns.property')}</span>
              <p className="font-medium">{issue.property_address}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('repairs.columns.description')}</span>
              <p className="font-medium">{issue.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">{t('repairs.form.reportedAt')}</span>
                <p className="font-medium">{formatDate(issue.reported_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('repairs.columns.status')}</span>
                <div className="mt-0.5">
                  <Badge variant={statusVariant[issue.status] ?? 'secondary'}>{t(`repairs.statuses.${issue.status}`)}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">{t('repairs.columns.requestedBy')}</span>
                <div className="mt-0.5">
                  <Badge variant={payerVariant[issue.requested_by] ?? 'secondary'}>{t(`repairs.payers.${issue.requested_by}`)}</Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('repairs.columns.payer')}</span>
                <div className="mt-0.5">
                  <Badge variant={payerVariant[issue.payer] ?? 'secondary'} className={issue.payer === 'tenant' ? 'bg-purple-100 text-purple-800 border-transparent' : ''}>{t(`repairs.payers.${issue.payer}`)}</Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="text-sm">
            <span className="text-muted-foreground">{t('repairs.columns.estimate')}</span>
            {issue.estimate_amount != null ? (
              <p className="font-semibold text-lg">{formatCurrency(Number(issue.estimate_amount))}</p>
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <Badge variant="warning">{t('repairs.detail.noEstimate')}</Badge>
              </div>
            )}
          </div>

          {issue.receipt_file_url && (
            <>
              <Separator />
              <div className="text-sm">
                <span className="text-muted-foreground">{t('repairs.detail.receipt')}</span>
                <a href={issue.receipt_file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline mt-1">
                  <ExternalLink className="h-3.5 w-3.5" />{t('repairs.detail.viewReceipt')}
                </a>
              </div>
            </>
          )}

          <Separator />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1" />{t('repairs.editBtn')}
            </Button>
            <Button variant="outline" className="flex-1" onClick={onDelete} disabled={issue.status !== 'resolved'}>
              <Trash2 className="h-4 w-4 mr-1" />{t('repairs.deleteBtn')}
            </Button>
          </div>
          {issue.status !== 'resolved' && (
            <p className="text-xs text-muted-foreground text-center">{t('repairs.delete.activeHint')}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
