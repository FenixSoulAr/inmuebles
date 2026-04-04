import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const routeTitleKeys: Record<string, string> = {
  '/': 'nav.dashboard',
  '/propiedades': 'nav.propiedades',
  '/inquilinos': 'nav.inquilinos',
  '/cobranza': 'nav.cobranza',
  '/reparaciones': 'nav.reparaciones',
  '/impuestos': 'nav.impuestos',
  '/documentos': 'nav.documentos',
  '/reportes': 'nav.reportes',
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { t } = useTranslation()

  const titleKey = routeTitleKeys[location.pathname] ?? ''
  const title = titleKey ? t(titleKey) : 'MyRentaHub'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <footer className="text-xs text-center p-2">v0.2.0</footer>
    </div>
  )
}
