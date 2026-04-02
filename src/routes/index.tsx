import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Propiedades from '@/pages/propiedades/Propiedades'
import Inquilinos from '@/pages/inquilinos/Inquilinos'
import Cobranza from '@/pages/cobranza/Cobranza'
import Reparaciones from '@/pages/reparaciones/Reparaciones'
import Impuestos from '@/pages/impuestos/Impuestos'
import Documentos from '@/pages/documentos/Documentos'
import Reportes from '@/pages/reportes/Reportes'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'propiedades', element: <Propiedades /> },
      { path: 'inquilinos', element: <Inquilinos /> },
      { path: 'cobranza', element: <Cobranza /> },
      { path: 'reparaciones', element: <Reparaciones /> },
      { path: 'impuestos', element: <Impuestos /> },
      { path: 'documentos', element: <Documentos /> },
      { path: 'reportes', element: <Reportes /> },
    ],
  },
])
