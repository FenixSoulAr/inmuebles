import { useEffect, useState } from "react";
import { Plus, Building2, Mail, Phone, MapPin, Pencil, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Owner {
  id: string;
  full_name: string;
  dni_cuit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

const ownerSchema = z.object({
  full_name: z.string().min(1, "El nombre es obligatorio"),
  dni_cuit: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
type OwnerFormData = z.infer<typeof ownerSchema>;

export default function Owners() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [deleteOwner, setDeleteOwner] = useState<Owner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<OwnerFormData>({
    resolver: zodResolver(ownerSchema),
  });

  useEffect(() => {
    if (user) fetchOwners();
  }, [user]);

  const fetchOwners = async () => {
    setError(null);
    try {
      const { data, error } = await supabase
        .from("owners" as any)
        .select("*")
        .order("full_name");
      if (error) throw error;
      setOwners(((data as unknown) as Owner[]) || []);
    } catch (err: any) {
      console.error("Error fetching owners:", err);
      setError("No se pudieron cargar los propietarios.");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingOwner(null);
    reset({});
    setDialogOpen(true);
  };

  const openEdit = (owner: Owner) => {
    setEditingOwner(owner);
    reset({
      full_name: owner.full_name,
      dni_cuit: owner.dni_cuit || "",
      email: owner.email || "",
      phone: owner.phone || "",
      address: owner.address || "",
      notes: owner.notes || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: OwnerFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const payload = {
        full_name: data.full_name.trim(),
        dni_cuit: data.dni_cuit?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
      };

      if (editingOwner) {
        const { error } = await supabase
          .from("owners" as any)
          .update(payload)
          .eq("id", editingOwner.id);
        if (error) throw error;
        toast({ title: "Propietario actualizado" });
      } else {
        const { error } = await supabase
          .from("owners" as any)
          .insert({ ...payload, owner_user_id: user.id });
        if (error) throw error;
        toast({ title: "Propietario creado" });
      }
      setDialogOpen(false);
      reset();
      fetchOwners();
    } catch (err: any) {
      console.error("Error saving owner:", err);
      toast({ title: "Error", description: "No se pudo guardar el propietario.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteOwner) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("owners" as any)
        .delete()
        .eq("id", deleteOwner.id);
      if (error) throw error;
      toast({ title: "Propietario eliminado" });
      setDeleteOwner(null);
      fetchOwners();
    } catch (err: any) {
      console.error("Error deleting owner:", err);
      toast({ title: "Error", description: "No se pudo eliminar. Puede estar vinculado a propiedades.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = owners.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.full_name.toLowerCase().includes(q) ||
      (o.dni_cuit || "").toLowerCase().includes(q) ||
      (o.email || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Propietarios"
        description="Administrá los propietarios y su vinculación con propiedades."
      >
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo propietario
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error} <button onClick={fetchOwners} className="underline ml-1">Reintentar</button></AlertDescription>
        </Alert>
      )}

      <div className="mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, DNI/CUIT o email…"
          className="max-w-md"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hay propietarios"
          description={search ? "Ningún propietario coincide con la búsqueda." : "Creá el primer propietario para vincularlo a propiedades."}
          action={!search ? { label: "Nuevo propietario", onClick: openCreate } : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((owner) => (
            <Card key={owner.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                      {owner.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{owner.full_name}</p>
                      {owner.dni_cuit && (
                        <p className="text-xs text-muted-foreground">DNI/CUIT: {owner.dni_cuit}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(owner)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteOwner(owner)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {owner.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{owner.email}</span>
                    </div>
                  )}
                  {owner.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{owner.phone}</span>
                    </div>
                  )}
                  {owner.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{owner.address}</span>
                    </div>
                  )}
                  {owner.notes && (
                    <p className="text-xs mt-2 text-muted-foreground/80 line-clamp-2">{owner.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOwner ? "Editar propietario" : "Nuevo propietario"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="full_name">Nombre completo *</Label>
                <Input id="full_name" placeholder="Juan García" {...register("full_name")} />
                {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dni_cuit">DNI / CUIT</Label>
                <Input id="dni_cuit" placeholder="20-12345678-9" {...register("dni_cuit")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" placeholder="+54 11 1234-5678" {...register("phone")} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="propietario@email.com" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="address">Domicilio</Label>
                <Input id="address" placeholder="Av. Corrientes 1234, CABA" {...register("address")} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" placeholder="Información adicional…" rows={2} {...register("notes")} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingOwner ? "Guardar cambios" : "Crear propietario"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteOwner} onOpenChange={(open) => !open && setDeleteOwner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar propietario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteOwner?.full_name}</strong>. Esta acción no se puede deshacer.
              Si el propietario está vinculado a una propiedad, la operación fallará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
