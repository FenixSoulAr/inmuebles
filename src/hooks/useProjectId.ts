import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Returns the active project_id for the current user.
 * For now picks the first project where the user is a member.
 */
export function useProjectId() {
  const { user } = useAuth()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const fetch = async () => {
      const { data } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      setProjectId(data?.project_id ?? null)
      setLoading(false)
    }

    fetch()
  }, [user])

  return { projectId, loading }
}
