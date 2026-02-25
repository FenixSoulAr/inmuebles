import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Project {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  role: string; // user's role in this project
}

interface ProjectContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  loading: boolean;
  setActiveProjectId: (id: string) => void;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = "myrentahub_active_project";

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setActiveProjectIdState(null);
      setLoading(false);
      return;
    }

    try {
      // Get user's memberships
      const { data: memberships, error: memError } = await supabase
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (memError) throw memError;

      if (!memberships || memberships.length === 0) {
        // No projects — create one automatically
        const { data: newProject, error: createError } = await supabase
          .from("projects")
          .insert({ name: "Mi cartera", created_by: user.id })
          .select("id, name, created_by, created_at")
          .single();

        if (createError) throw createError;

        // Add user as owner
        await supabase.from("project_members").insert({
          project_id: newProject.id,
          user_id: user.id,
          role: "owner",
          status: "active",
        });

        const project: Project = { ...newProject, role: "owner" };
        setProjects([project]);
        setActiveProjectId(project.id);
        setLoading(false);
        return;
      }

      // Fetch project details
      const projectIds = memberships.map((m) => m.project_id);
      const { data: projectData, error: projError } = await supabase
        .from("projects")
        .select("id, name, created_by, created_at")
        .in("id", projectIds);

      if (projError) throw projError;

      const roleMap = new Map(memberships.map((m) => [m.project_id, m.role]));
      const projectList: Project[] = (projectData || []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) || "viewer",
      }));

      setProjects(projectList);

      // Restore active project from localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && projectList.some((p) => p.id === stored)) {
        setActiveProjectIdState(stored);
      } else if (projectList.length > 0) {
        setActiveProjectId(projectList[0].id);
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  }, [user, setActiveProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProjectId,
        activeProject,
        loading,
        setActiveProjectId,
        refreshProjects: fetchProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};
