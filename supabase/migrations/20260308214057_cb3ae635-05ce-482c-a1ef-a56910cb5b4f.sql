
-- Security definer function to check if two users share a project
CREATE OR REPLACE FUNCTION public.shares_project_with(_viewer_uid uuid, _target_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_members pm1
    JOIN project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = _viewer_uid
      AND pm2.user_id = _target_uid
      AND pm1.status = 'active'
      AND pm2.status = 'active'
  )
$$;

-- Allow users to see profiles of people they share a project with
CREATE POLICY "Users can view co-member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (shares_project_with(auth.uid(), id));
