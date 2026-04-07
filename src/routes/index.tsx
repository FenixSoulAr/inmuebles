import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import Dashboard from '@/pages/Dashboard'
import Propiedades from '@/pages/propiedades/Propiedades'
import Inquilinos from '@/pages/inquilinos/Inquilinos'
import Contratos from '@/pages/contratos/Contratos'
import Cobranza from '@/pages/cobranza/Cobranza'
import Reparaciones from '@/pages/reparaciones/Reparaciones'
import Impuestos from '@/pages/impuestos/Impuestos'
import Documentos from '@/pages/documentos/Documentos'
import Reportes from '@/pages/reportes/Reportes'
import SignIn from '@/pages/auth/SignIn'
import SignUp from '@/pages/auth/SignUp'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import PortalPage from '@/pages/portal/PortalPage'
import PortalLogin from '@/pages/portal/PortalLogin'
import PortalSetup from '@/pages/portal/PortalSetup'
import { TenantRoute } from '@/components/portal/TenantRoute'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/signin', element: <SignIn /> },
      { path: '/signup', element: <SignUp /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/portal/login', element: <PortalLogin /> },
      { path: '/portal/setup', element: <PortalSetup /> },
      {
        path: '/portal',
        element: (
          <TenantRoute>
            <PortalPage />
          </TenantRoute>
        ),
      },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'propiedades', element: <Propiedades /> },
          { path: 'inquilinos', element: <Inquilinos /> },
          { path: 'contratos', element: <Contratos /> },
          { path: 'cobranza', element: <Cobranza /> },
          { path: 'reparaciones', element: <Reparaciones /> },
          { path: 'impuestos', element: <Impuestos /> },
          { path: 'documentos', element: <Documentos /> },
          { path: 'reportes', element: <Reportes /> },
        ],
      },
    ],
  },
])
