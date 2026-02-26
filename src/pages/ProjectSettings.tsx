import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, UserPlus, Trash2, Settings, Users, Mail } from "lucide-react";

interface Member {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  email?: string;
  full_name?: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "collaborator", label: "Colaborador" },
  { value: "viewer", label: "Visor" },
];

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "owner": return "default";
    case "admin": return "secondary";
    case "collaborator": return "outline";
    default: return "outline";
  }
};

export default function ProjectSettings() {
  const { activeProjectId, activeProject, refreshProjects } = useProject();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("collaborator");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Delete member
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const currentUserRole = activeProject?.role;
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  const fetchData = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);

    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from("project_members")
        .select("id, user_id, role, status, created_at")
        .eq("project_id", activeProjectId)
        .eq("status", "active"),
      supabase
        .from("project_invites")
        .select("id, email, role, status, token, created_at, expires_at")
        .eq("project_id", activeProjectId)
        .order("created_at", { ascending: false }),
    ]);

    // Enrich members with profile info
    const rawMembers = membersRes.data || [];
    if (rawMembers.length > 0) {
      const userIds = rawMembers.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      setMembers(
        rawMembers.map((m) => ({
          ...m,
          email: profileMap.get(m.user_id)?.email,
          full_name: profileMap.get(m.user_id)?.full_name ?? undefined,
        }))
      );
    } else {
      setMembers([]);
    }

    setInvites(invitesRes.data || []);
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeProject) setProjectName(activeProject.name);
  }, [activeProject]);

  const handleSaveName = async () => {
    if (!activeProjectId || !projectName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from("projects")
      .update({ name: projectName.trim() })
      .eq("id", activeProjectId);
    setSavingName(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nombre actualizado" });
      refreshProjects();
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("project_members")
      .update({ role: newRole as any })
      .eq("id", memberId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rol actualizado" });
      fetchData();
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberToRemove.id);
    setMemberToRemove(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Miembro removido" });
      fetchData();
    }
  };

  const handleCreateInvite = async () => {
    if (!activeProjectId || !inviteEmail.trim()) return;
    setSendingInvite(true);
    const { error } = await supabase.from("project_invites").insert({
      project_id: activeProjectId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole as any,
      invited_by: user!.id,
    });
    setSendingInvite(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invitación creada" });
      setInviteEmail("");
      fetchData();
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("project_invites")
      .update({ status: "cancelled" })
      .eq("id", inviteId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invitación cancelada" });
      fetchData();
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `https://myrentahub.fenixsoular.com.ar/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!activeProjectId) return null;

  const pendingInvites = invites.filter((i) => i.status === "pending");
  const pastInvites = invites.filter((i) => i.status !== "pending");

  return (
    <div className="container max-w-4xl py-6">
      <PageHeader
        title="Configuración del proyecto"
        description="Gestioná miembros, roles e invitaciones."
      />

      {/* Project Name */}
      {currentUserRole === "owner" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5" /> General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>Nombre del proyecto</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveName} disabled={savingName || projectName === activeProject?.name}>
                {savingName ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" /> Miembros
          </CardTitle>
          <CardDescription>
            {members.length} miembro{members.length !== 1 ? "s" : ""} activo{members.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  {isAdmin && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const isCurrentUser = m.user_id === user?.id;
                  const isOwner = m.role === "owner";
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {m.full_name || m.email || "—"}
                            {isCurrentUser && (
                              <span className="text-muted-foreground ml-1">(tú)</span>
                            )}
                          </p>
                          {m.full_name && m.email && (
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isAdmin && !isCurrentUser && !isOwner ? (
                          <Select
                            value={m.role}
                            onValueChange={(val) => handleChangeRole(m.id, val)}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.filter((r) =>
                                currentUserRole === "owner" || r.value !== "owner"
                              ).map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={roleBadgeVariant(m.role) as any}>
                            {ROLE_OPTIONS.find((r) => r.value === m.role)?.label || m.role}
                          </Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {!isCurrentUser && !isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMemberToRemove(m)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invitations */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5" /> Invitaciones
            </CardTitle>
            <CardDescription>
              Invitá nuevos miembros con un link único.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create invite form */}
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 space-y-1.5 w-full">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="ejemplo@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 w-full sm:w-[160px]">
                <Label>Rol</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.filter((r) =>
                      currentUserRole === "owner" || r.value !== "owner"
                    ).map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateInvite}
                disabled={sendingInvite || !inviteEmail.trim()}
              >
                <UserPlus className="w-4 h-4 mr-1" />
                {sendingInvite ? "Enviando..." : "Invitar"}
              </Button>
            </div>

            {/* Pending invites */}
            {pendingInvites.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Pendientes</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Expira</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvites.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm">{inv.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ROLE_OPTIONS.find((r) => r.value === inv.role)?.label || inv.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyInviteLink(inv.token)}
                              title="Copiar link"
                            >
                              {copiedToken === inv.token ? (
                                <Check className="w-4 h-4 text-primary" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelInvite(inv.id)}
                              className="text-destructive hover:text-destructive"
                              title="Cancelar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Past invites */}
            {pastInvites.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Historial</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastInvites.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm">{inv.email}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === "accepted" ? "default" : "secondary"}>
                            {inv.status === "accepted" ? "Aceptada" : inv.status === "cancelled" ? "Cancelada" : "Expirada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DeleteConfirmationModal
        open={!!memberToRemove}
        onOpenChange={() => setMemberToRemove(null)}
        title="Remover miembro"
        description={`¿Estás seguro de que querés remover a ${memberToRemove?.full_name || memberToRemove?.email || "este usuario"} del proyecto?`}
        onConfirm={handleRemoveMember}
      />
    </div>
  );
}
