import { NavLink } from 'react-router-dom'
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
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/propiedades', label: 'Propiedades', icon: Building2 },
  { to: '/inquilinos', label: 'Inquilinos', icon: Users },
  { to: '/cobranza', label: 'Cobranza', icon: CreditCard },
  { to: '/reparaciones', label: 'Reparaciones', icon: Wrench },
  { to: '/impuestos', label: 'Impuestos', icon: FileText },
  { to: '/documentos', label: 'Documentos', icon: FolderOpen },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6">
          <img src={logoSrc} alt="MyRentaHub" className="h-8 w-auto" />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navegacion */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
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
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Version */}
        <div className="px-6 py-4">
          <p className="text-xs text-sidebar-foreground/40">v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
