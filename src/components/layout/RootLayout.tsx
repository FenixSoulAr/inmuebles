import { Outlet } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'sonner'

export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}
