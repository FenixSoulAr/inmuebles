import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileCheck, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useProjectId } from '@/hooks/useProjectId'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'

interface EnrichedProof {
  id: string
  contract_id: string
  obligation_id: string | null
  type: string
  service_type: string | null
  period: string
  amount: number
  paid_at: string
  files: string[]
  comment: string | null
  created_at: string
  tenant_name: string
  property_address: string
  currency: string
}

export default function PendingProofs() {
  const { t } = useTranslation()
  const { projectId } = useProjectId()
  const [proofs, setProofs] = useState<EnrichedProof[]>([])
  const [loading, setLoading] = useState(true)

  const [approveId, setApproveId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchProofs = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('payment_proofs')
      .select(`
        *,
        contracts (
          id,
          currency,
          tenants ( full_name ),
          properties ( full_address )
        )
      `)
      .eq('project_id', projectId)
      .eq('proof_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('fetchProofs error:', error)
      setProofs([])
      setLoading(false)
      return
    }

    const enriched: EnrichedProof[] = (data ?? []).map((p: any) => ({
      id: p.id,
      contract_id: p.contract_id,
      type: p.type,
      service_type: p.service_type,
      period: p.period,
      amount: Number(p.amount),
      paid_at: p.paid_at,
      files: p.files ?? [],
      comment: p.comment,
      created_at: p.created_at,
      tenant_name: p.contracts?.tenants?.full_name ?? '—',
      property_address: p.contracts?.properties?.full_address ?? '—',
      currency: p.contracts?.currency ?? 'ARS',
    }))

    setProofs(enriched)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (projectId) fetchProofs()
  }, [projectId, fetchProofs])

  const handleViewFile = async (filePath: string) => {
    const { data } = await supabase.storage.from('proof-files').createSignedUrl(filePath, 120)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    } else {
      toast.error(t('cobranza.proofs.fileError'))
    }
  }

  const handleApprove = async () => {
    if (!approveId) return
    const proof = proofs.find(p => p.id === approveId)
    if (!proof) return

    // 1. Update proof status
    const { error: proofErr } = await supabase.from('payment_proofs').update({
      proof_status: 'approved',
      approved_at: new Date().toISOString(),
    }).eq('id', approveId).eq('project_id', projectId!)
    if (proofErr) {
      toast.error(t('cobranza.proofs.approveError'))
      setApproveId(null)
      return
    }

    // 2. Insert payment record
    const { error: payErr } = await supabase.from('payments').insert({
      project_id: projectId!,
      contract_id: proof.contract_id,
      obligation_id: proof.obligation_id ?? null,
      amount: proof.amount,
      method: 'transfer',
      concept: proof.type === 'service'
        ? `Servicio: ${proof.service_type}`
        : `Alquiler ${proof.period}`,
      paid_at: proof.paid_at,
      notes: proof.comment ?? null,
    })
    if (payErr) {
      toast.error(t('cobranza.proofs.approveError'))
      setApproveId(null)
      return
    }

    // 3. If linked to a rent_due, mark it paid
    if (proof.obligation_id) {
      const { error: dueErr } = await supabase.from('rent_dues').update({
        status: 'paid',
        balance_due: 0,
      }).eq('id', proof.obligation_id)
      if (dueErr) {
        toast.error(t('cobranza.proofs.approveError'))
        setApproveId(null)
        return
      }
    }

    toast.success(t('cobranza.proofs.approved'))
    fetchProofs()
    setApproveId(null)
  }

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return
    const { error } = await supabase.from('payment_proofs').update({
      proof_status: 'rejected',
      rejection_reason: rejectReason.trim(),
    }).eq('id', rejectId).eq('project_id', projectId!)
    if (error) {
      toast.error(t('cobranza.proofs.rejectError'))
    } else {
      toast.success(t('cobranza.proofs.rejected'))
      fetchProofs()
    }
    setRejectId(null)
    setRejectReason('')
  }

  if (loading || proofs.length === 0) return null

  const typeLabel = (p: EnrichedProof) =>
    p.type === 'service'
      ? t(`cobranza.proofs.serviceTypes.${p.service_type ?? 'otro'}`)
      : t('cobranza.proofs.typeRent')

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileCheck className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">{t('cobranza.proofs.title')}</h3>
        <Badge variant="destructive">{proofs.length}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {proofs.map(p => (
          <Card key={p.id} className="border-orange-200 bg-orange-50/30">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{p.tenant_name}</span>
                <Badge variant="warning">{typeLabel(p)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{p.property_address}</p>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <span className="text-muted-foreground">{t('cobranza.proofs.period')}:</span>
                <span>{p.period}</span>
                <span className="text-muted-foreground">{t('cobranza.proofs.amount')}:</span>
                <span className="font-medium">{formatCurrency(p.amount, p.currency)}</span>
                <span className="text-muted-foreground">{t('cobranza.proofs.paidAt')}:</span>
                <span>{formatDate(p.paid_at)}</span>
                <span className="text-muted-foreground">{t('cobranza.proofs.sentAt')}:</span>
                <span>{formatDate(p.created_at)}</span>
              </div>
              {p.comment && (
                <p className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2">
                  "{p.comment}"
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                {p.files.length > 0 && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewFile(p.files[0])}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {t('cobranza.proofs.viewFile')}
                  </Button>
                )}
                <Button variant="default" size="sm" onClick={() => setApproveId(p.id)}>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('cobranza.proofs.approve')}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setRejectId(p.id)}>
                  <XCircle className="h-3 w-3 mr-1" />
                  {t('cobranza.proofs.reject')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Approve dialog */}
      <AlertDialog open={!!approveId} onOpenChange={o => { if (!o) setApproveId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cobranza.proofs.approveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cobranza.proofs.approveDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>{t('cobranza.proofs.approve')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={o => { if (!o) { setRejectId(null); setRejectReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cobranza.proofs.rejectTitle')}</DialogTitle>
            <DialogDescription>{t('cobranza.proofs.rejectDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('cobranza.proofs.rejectReasonLabel')}</Label>
            <Input
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={t('cobranza.proofs.rejectReasonPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason('') }}>{t('common.cancel')}</Button>
            <Button variant="destructive" disabled={!rejectReason.trim()} onClick={handleReject}>
              {t('cobranza.proofs.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
