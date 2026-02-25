import { useEffect, useState } from "react";
import { Plus, Trash2, UserCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Owner {
  id: string;
  full_name: string;
  dni_cuit: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
}

interface PropertyOwnerLink {
  id: string;
  owner_id: string;
  ownership_percent: number | null;
  role: string | null;
  owners: Owner;
}

interface PropertyOwnersProps {
  propertyId: string;
}

const ROLE_LABELS: Record<string, string> = {
  titular: "Titular",
  cotitular: "Cotitular",
  apoderado: "Apoderado",
  heredero: "Heredero",
  otro: "Otro",
};

export function PropertyOwners({ propertyId }: PropertyOwnersProps) {
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const { toast } = useToast();
  const [links, setLinks] = useState<PropertyOwnerLink[]>([]);
  const [allOwners, setAllOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOwnerDialogOpen, setNewOwnerDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add-existing form
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedRole, setSelectedRole] = useState("titular");
  const [selectedPercent, setSelectedPercent] = useState("");

  // Create-new-owner form
  const [newOwner, setNewOwner] = useState({
    full_name: "",
    dni_cuit: "",
    address: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (propertyId) {
      fetchLinks();
      fetchAllOwners();
    }
  }, [propertyId]);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("property_owners" as any)
        .select("id, owner_id, ownership_percent, role, owners(id, full_name, dni_cuit, address, email, phone)")
        .eq("property_id", propertyId)
        .order("created_at");
      if (error) throw error;
      setLinks((data as any[]) || []);
    } catch (err) {
      console.error("Error fetching property owners:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllOwners = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("owners" as any)
        .select("id, full_name, dni_cuit, address, email, phone")
        .order("full_name");
      setAllOwners((data as any[]) || []);
    } catch (err) {
      console.error("Error fetching owners list:", err);
    }
  };

  const handleCreateOwner = async () => {
    if (!user || !newOwner.full_name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("owners" as any)
        .insert({
          project_id: activeProjectId!,
          full_name: newOwner.full_name.trim(),
          dni_cuit: newOwner.dni_cuit || null,
          address: newOwner.address || null,
          email: newOwner.email || null,
          phone: newOwner.phone || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Propietario creado" });
      await fetchAllOwners();
      setSelectedOwnerId((data as any).id);
      setNewOwner({ full_name: "", dni_cuit: "", address: "", email: "", phone: "" });
      setNewOwnerDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLink = async () => {
    if (!selectedOwnerId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("property_owners" as any)
        .insert({
          property_id: propertyId,
          owner_id: selectedOwnerId,
          role: selectedRole || null,
          ownership_percent: selectedPercent ? Number(selectedPercent) : null,
        });
      if (error) throw error;
      toast({ title: "Propietario asociado" });
      setSelectedOwnerId("");
      setSelectedRole("titular");
      setSelectedPercent("");
      setDialogOpen(false);
      fetchLinks();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Ya estaba asociado o error desconocido.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from("property_owners" as any)
        .delete()
        .eq("id", linkId);
      if (error) throw error;
      toast({ title: "Propietario desvinculado" });
      fetchLinks();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  const availableOwners = allOwners.filter(
    (o) => !links.some((l) => l.owner_id === o.id)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle2 className="w-4 h-4" />
            Propietarios
            {links.length > 0 && (
              <Badge variant="secondary" className="text-xs">{links.length}</Badge>
            )}
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Agregar propietario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Asociar propietario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Propietario</Label>
                    <Dialog open={newOwnerDialogOpen} onOpenChange={setNewOwnerDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-xs h-7">
                          <Plus className="w-3 h-3 mr-1" /> Crear nuevo
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Nuevo propietario</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div className="space-y-1">
                            <Label>Nombre completo *</Label>
                            <Input
                              value={newOwner.full_name}
                              onChange={(e) => setNewOwner((p) => ({ ...p, full_name: e.target.value }))}
                              placeholder="Ej: Juan García"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>DNI / CUIT</Label>
                            <Input
                              value={newOwner.dni_cuit}
                              onChange={(e) => setNewOwner((p) => ({ ...p, dni_cuit: e.target.value }))}
                              placeholder="20-12345678-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Domicilio real</Label>
                            <Input
                              value={newOwner.address}
                              onChange={(e) => setNewOwner((p) => ({ ...p, address: e.target.value }))}
                              placeholder="Calle 123, CABA"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label>Email</Label>
                              <Input
                                type="email"
                                value={newOwner.email}
                                onChange={(e) => setNewOwner((p) => ({ ...p, email: e.target.value }))}
                                placeholder="email@ejemplo.com"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Teléfono</Label>
                              <Input
                                value={newOwner.phone}
                                onChange={(e) => setNewOwner((p) => ({ ...p, phone: e.target.value }))}
                                placeholder="+54 11..."
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setNewOwnerDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleCreateOwner} disabled={saving || !newOwner.full_name.trim()}>
                              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear propietario"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar propietario…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOwners.length === 0 ? (
                        <SelectItem value="_none" disabled>
                          Sin propietarios disponibles
                        </SelectItem>
                      ) : (
                        availableOwners.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.full_name}{o.dni_cuit ? ` — ${o.dni_cuit}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Rol</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>% de titularidad (opcional)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="Ej: 50"
                      value={selectedPercent}
                      onChange={(e) => setSelectedPercent(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddLink} disabled={saving || !selectedOwnerId}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Asociar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando propietarios…
          </div>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Sin propietarios registrados. Agregá al menos uno para incluirlo en el contrato.
          </p>
        ) : (
          <div className="space-y-3">
            {links.map((link, idx) => (
              <div key={link.id}>
                {idx > 0 && <Separator className="mb-3" />}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{link.owners?.full_name}</p>
                      {link.role && (
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[link.role] || link.role}
                        </Badge>
                      )}
                      {link.ownership_percent != null && (
                        <Badge variant="secondary" className="text-xs">
                          {link.ownership_percent}%
                        </Badge>
                      )}
                    </div>
                    {link.owners?.dni_cuit && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        DNI/CUIT: {link.owners.dni_cuit}
                      </p>
                    )}
                    {link.owners?.address && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {link.owners.address}
                      </p>
                    )}
                    {link.owners?.email && (
                      <p className="text-xs text-muted-foreground">{link.owners.email}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveLink(link.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
