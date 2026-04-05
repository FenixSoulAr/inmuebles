import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  Users,
  CreditCard,
  Wrench,
  FileText,
  FolderOpen,
  BarChart3,
  LayoutDashboard,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import logoSrc from '@/assets/logo-lockup-transparent.png'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/propiedades', labelKey: 'nav.propiedades', icon: Building2 },
  { to: '/inquilinos', labelKey: 'nav.inquilinos', icon: Users },
  { to: '/contratos', labelKey: 'nav.contratos', icon: FileText },
  { to: '/cobranza', labelKey: 'nav.cobranza', icon: CreditCard },
  { to: '/reparaciones', labelKey: 'nav.reparaciones', icon: Wrench },
  { to: '/impuestos', labelKey: 'nav.impuestos', icon: FileText },
  { to: '/documentos', labelKey: 'nav.documentos', icon: FolderOpen },
  { to: '/reportes', labelKey: 'nav.reportes', icon: BarChart3 },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useTranslation()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between bg-white border-b border-border px-4 py-4">
          <img src={logoSrc} alt="MyRentaHub" className="h-8 w-auto" />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-foreground hover:bg-muted"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map(({ to, labelKey, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-6 py-4">
          <p className="text-xs text-sidebar-foreground/40">v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
