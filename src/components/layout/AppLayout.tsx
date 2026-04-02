import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/propiedades': 'Propiedades',
  '/inquilinos': 'Inquilinos',
  '/cobranza': 'Cobranza',
  '/reparaciones': 'Reparaciones',
  '/impuestos': 'Impuestos',
  '/documentos': 'Documentos',
  '/reportes': 'Reportes',
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const title = routeTitles[location.pathname] ?? 'MyRentaHub'

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
