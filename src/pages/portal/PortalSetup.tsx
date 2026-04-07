import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import logoFull from '@/assets/logo-full.png'

export default function PortalSetup() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // The invite link includes a token hash that Supabase processes automatically
    // We just need to wait for the session to be established
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
      }
      setVerifying(false)
    }

    // Listen for auth state changes (invite token processing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setSessionReady(true)
          setVerifying(false)
        }
      }
    )

    // Give Supabase a moment to process the invite token
    setTimeout(checkSession, 1000)

    return () => subscription.unsubscribe()
  }, [])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError(t('portal.passwordTooShort'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('portal.passwordsMismatch'))
      return
    }

    setLoading(true)

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      // Get current user to link tenant record
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        // Update tenant auth_user_id — use service role via RPC or direct update
        // Since RLS allows the tenant to update their own record after linking,
        // we rely on the edge function having already set auth_user_id during invite
        // Just ensure the metadata is correct
        const tenantId = user.user_metadata?.tenant_id
        if (tenantId) {
          await supabase
            .from('tenants')
            .update({ auth_user_id: user.id } as Record<string, unknown>)
            .eq('id', tenantId)
        }
      }

      toast.success(t('portal.setupComplete'))
      navigate('/portal', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <img src={logoFull} alt="MyRentaHub" className="mx-auto mb-4 h-12 w-auto" />
            <CardTitle className="text-lg">{t('portal.invalidLink')}</CardTitle>
            <CardDescription>{t('portal.invalidLinkDesc')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <img src={logoFull} alt="MyRentaHub" className="mx-auto mb-4 h-12 w-auto" />
          <CardTitle className="text-lg flex items-center justify-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t('portal.setupTitle')}
          </CardTitle>
          <CardDescription>{t('portal.setupDesc')}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSetPassword}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">{t('portal.newPassword')}</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pr-9"
                  placeholder={t('portal.passwordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">{t('portal.confirmPassword')}</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t('portal.confirmPlaceholder')}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('portal.setPassword')}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
