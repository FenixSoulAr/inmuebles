import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LogOut, Home, AlertTriangle, CalendarClock, CreditCard, Loader2, Upload, FileCheck, Info } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import logoFull from '@/assets/logo-full.png'
import SubirComprobante from '@/components/portal/SubirComprobante'

interface ContractData {
  id: string
  start_date: string
  end_date: string
  current_rent: number
  currency: string | null
  is_active: boolean
  project_id: string
  properties: { full_address: string } | null
}

interface RentDue {
  id: string
  due_date: string
  expected_amount: number
  balance_due: number
  status: string
  period_month: string
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  method: string
  rent_due_id: string
}

interface ProofRecord {
  id: string
  obligation_id: string | null
  period: string
  amount: number
  created_at: string
  proof_status: string
  rejection_reason: string | null
}

export default function PortalPage() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [rentDues, setRentDues] = useState<RentDue[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [proofs, setProofs] = useState<ProofRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showPayments, setShowPayments] = useState(false)
  const [showProofs, setShowProofs] = useState(false)
  const [uploadDue, setUploadDue] = useState<RentDue | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: contractData } = await supabase
        .from('contracts')
        .select('id, start_date, end_date, current_rent, currency, is_active, project_id, properties(full_address)')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (contractData) {
        setContract(contractData as unknown as ContractData)

        // Fetch rent dues, payments, and proofs in parallel
        const [duesRes, paymentsRes, proofsRes] = await Promise.all([
          supabase.from('rent_dues').select('*').eq('contract_id', contractData.id).order('due_date', { ascending: false }).limit(12),
          supabase.from('rent_payments').select('*').order('payment_date', { ascending: false }).limit(20),
          supabase.from('payment_proofs').select('id, obligation_id, period, amount, created_at, proof_status, rejection_reason').eq('contract_id', contractData.id).order('created_at', { ascending: false }).limit(10),
        ])

        if (duesRes.data) setRentDues(duesRes.data)
        if (paymentsRes.data) setPayments(paymentsRes.data)
        if (proofsRes.data) setProofs(proofsRes.data as ProofRecord[])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getDisplayStatus = (due: RentDue) => {
    if (due.balance_due <= 0 || due.status === 'paid') return 'paid'
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(due.due_date)
    dueDate.setHours(0, 0, 0, 0)
    return dueDate < today ? 'overdue' : 'upcoming'
  }

  const getProofForDue = (dueId: string) => {
    return proofs.find(p => p.obligation_id === dueId)
  }

  const totalDebt = rentDues
    .filter(d => getDisplayStatus(d) === 'overdue')
    .reduce((sum, d) => sum + d.balance_due, 0)

  const nextDue = rentDues
    .filter(d => ['overdue', 'upcoming'].includes(getDisplayStatus(d)))
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]

  const lastPayment = payments[0]
  const currency = contract?.currency ?? 'ARS'

  const proofStatusVariant = (status: string) => {
    if (status === 'approved') return 'success' as const
    if (status === 'rejected') return 'destructive' as const
    return 'warning' as const
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <img src={logoFull} alt="MyRentaHub" className="h-8 w-auto" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground truncate max-w-[140px]">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {/* Active Contract Card */}
        {contract ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                {t('portal.activeContract')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-semibold">{(contract.properties as any)?.full_address}</p>
              <div className="flex justify-between text-muted-foreground">
                <span>{formatDate(contract.start_date)} — {formatDate(contract.end_date)}</span>
                <Badge variant={contract.is_active ? 'success' : 'secondary'}>
                  {contract.is_active ? t('portal.active') : t('portal.expired')}
                </Badge>
              </div>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(contract.current_rent, currency)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/{t('portal.month')}</span>
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('portal.noContract')}
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className={totalDebt > 0 ? 'border-destructive/50' : ''}>
            <CardContent className="p-3 text-center">
              <AlertTriangle className={`h-4 w-4 mx-auto mb-1 ${totalDebt > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground">{t('portal.totalDebt')}</p>
              <p className={`text-sm font-bold ${totalDebt > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatCurrency(totalDebt, currency)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 text-center">
              <CalendarClock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t('portal.nextDue')}</p>
              {nextDue ? (
                <>
                  <p className="text-sm font-bold">{formatCurrency(nextDue.balance_due, currency)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(nextDue.due_date)}</p>
                </>
              ) : (
                <p className="text-sm font-bold">—</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 text-center">
              <CreditCard className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t('portal.lastPayment')}</p>
              {lastPayment ? (
                <>
                  <p className="text-sm font-bold">{formatCurrency(lastPayment.amount, currency)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(lastPayment.payment_date)}</p>
                </>
              ) : (
                <p className="text-sm font-bold">—</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Dues */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('portal.recentDues')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rentDues.slice(0, 6).map(due => {
              const status = getDisplayStatus(due)
              const proof = getProofForDue(due.id)
              const canUpload = (status === 'overdue' || status === 'upcoming') && !proof

              return (
                <div key={due.id} className="flex items-center justify-between rounded-md border p-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{due.period_month}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('portal.dueOn')} {formatDate(due.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(due.expected_amount, currency)}</p>
                      {proof ? (
                        <Badge variant={proofStatusVariant(proof.proof_status)} className="text-[10px]">
                          <FileCheck className="h-3 w-3 mr-0.5" />
                          {t(`portal.proof.status.${proof.proof_status}`)}
                        </Badge>
                      ) : (
                        <Badge
                          variant={status === 'paid' ? 'success' : status === 'overdue' ? 'destructive' : 'default'}
                          className="text-[10px]"
                        >
                          {status === 'paid' ? t('portal.paid') : status === 'overdue' ? t('portal.overdue') : t('portal.pending')}
                        </Badge>
                      )}
                    </div>
                    {canUpload && contract && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setUploadDue(due)}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            {rentDues.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('portal.noDues')}</p>
            )}
          </CardContent>
        </Card>

        {/* My Proofs */}
        {proofs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <button
                onClick={() => setShowProofs(!showProofs)}
                className="flex w-full items-center justify-between"
              >
                <CardTitle className="text-base">{t('portal.proof.myProofs')}</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {showProofs ? t('portal.hide') : t('portal.show')}
                </span>
              </button>
            </CardHeader>
            {showProofs && (
              <CardContent className="space-y-2">
                {proofs.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{p.period}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{formatCurrency(p.amount, currency)}</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Badge variant={proofStatusVariant(p.proof_status)} className="text-[10px]">
                                {t(`portal.proof.status.${p.proof_status}`)}
                                {p.proof_status === 'rejected' && p.rejection_reason && (
                                  <Info className="h-3 w-3 ml-0.5" />
                                )}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          {p.proof_status === 'rejected' && p.rejection_reason && (
                            <TooltipContent>
                              <p className="text-xs max-w-[200px]">{p.rejection_reason}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )}

        {/* Payment History */}
        <Card>
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowPayments(!showPayments)}
              className="flex w-full items-center justify-between"
            >
              <CardTitle className="text-base">{t('portal.paymentHistory')}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {showPayments ? t('portal.hide') : t('portal.show')}
              </span>
            </button>
          </CardHeader>
          {showPayments && (
            <CardContent className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{formatDate(p.payment_date)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.method}</p>
                  </div>
                  <p className="text-sm font-semibold text-primary">{formatCurrency(p.amount, currency)}</p>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('portal.noPayments')}</p>
              )}
            </CardContent>
          )}
        </Card>
      </main>

      {/* Upload Sheet */}
      {uploadDue && contract && (
        <SubirComprobante
          open={!!uploadDue}
          onOpenChange={open => { if (!open) setUploadDue(null) }}
          due={uploadDue}
          contractId={contract.id}
          projectId={contract.project_id}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
