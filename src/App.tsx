// Force redeploy - 2026-04-03 v2
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes'

export default function App() {
  return <RouterProvider router={router} />
}
