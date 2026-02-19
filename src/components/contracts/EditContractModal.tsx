import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const BOOKING_CHANNELS = [
  { value: "directo", label: "Directo" },
  { value: "airbnb", label: "Airbnb" },
  { value: "booking", label: "Booking.com" },
  { value: "otro", label: "Otro" },
];

const DEPOSIT_MODES = [
  { value: "required", label: "Depósito en garantía" },
  { value: "not_required", label: "No se requiere depósito" },
  { value: "platform_covered", label: "Cubierto por plataforma" },
];

const contractSchema = z.object({
  end_date: z.string().min(1, "La fecha de fin es requerida."),
  clauses_text: z.string().optional(),
  has_price_update: z.boolean().default(false),
  adjustment_type: z.string().min(1),
  adjustment_frequency: z.coerce.number().min(1).optional(),
  next_adjustment_date: z.string().optional(),
  submission_language: z.string().min(1),
  booking_channel: z.string().default("directo"),
  deposit_mode: z.string().default("required"),
});

type ContractFormData = z.infer<typeof contractSchema>;

interface Contract {
  id: string;
  start_date: string;
  end_date: string;
  current_rent: number;
  initial_rent: number;
  deposit: number | null;
  is_active: boolean;
  adjustment_type: string;
  adjustment_frequency: number | null;
  clauses_text: string | null;
  next_adjustment_date: string | null;
  property_id: string;
  tenant_id: string;
  public_submission_token: string | null;
  token_status: string;
  submission_language?: string;
  tipo_contrato?: string | null;
  has_price_update?: boolean | null;
  booking_channel?: string | null;
  deposit_mode?: string | null;
}

interface EditContractModalProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  hasRentDues: boolean;
}

export function EditContractModal({
  contract,
  open,
  onOpenChange,
  onSuccess,
  hasRentDues,
}: EditContractModalProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
  });

  const selectedAdjustmentType = watch("adjustment_type");
  const watchHasPriceUpdate = watch("has_price_update");
  const watchBookingChannel = watch("booking_channel");
  const watchDepositMode = watch("deposit_mode");
  const isTemporario = contract?.tipo_contrato === "temporario";

  useEffect(() => {
    if (contract && open) {
      reset({
        end_date: contract.end_date,
        clauses_text: contract.clauses_text || "",
        has_price_update: contract.has_price_update ?? false,
        adjustment_type: contract.adjustment_type,
        adjustment_frequency: contract.adjustment_frequency || 12,
        next_adjustment_date: contract.next_adjustment_date || "",
        submission_language: contract.submission_language || "es",
        booking_channel: contract.booking_channel || "directo",
        deposit_mode: contract.deposit_mode || "required",
      });
    }
  }, [contract, open, reset]);

  const onSubmit = async (data: ContractFormData) => {
    if (!contract) return;

    if (data.end_date < contract.start_date) {
      toast({
        title: "Error",
        description: "La fecha de fin no puede ser anterior a la de inicio.",
        variant: "destructive",
      });
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const newEndDate = data.end_date;
      const wasInactive = !contract.is_active;
      const shouldBeActive = today <= newEndDate;
      const endDateReduced = newEndDate < contract.end_date;

      const effectiveHasPriceUpdate = isTemporario ? false : data.has_price_update;

      const updateData: Record<string, unknown> = {
        end_date: newEndDate,
        clauses_text: data.clauses_text || null,
        is_active: shouldBeActive,
        submission_language: data.submission_language,
        has_price_update: effectiveHasPriceUpdate,
        ...(isTemporario && {
          booking_channel: data.booking_channel || "directo",
          deposit_mode: data.deposit_mode || "required",
          deposit: data.deposit_mode === "required" ? undefined : null,
          currency_deposit: data.deposit_mode === "required" ? undefined : null,
        }),
      };

      if (!hasRentDues) {
        updateData.adjustment_type = effectiveHasPriceUpdate ? data.adjustment_type : "manual";
        updateData.adjustment_frequency = effectiveHasPriceUpdate ? data.adjustment_frequency : null;
      }

      if (data.next_adjustment_date) {
        updateData.next_adjustment_date = data.next_adjustment_date;
      }

      // Handle token logic
      if (shouldBeActive) {
        if (!contract.public_submission_token) {
          const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          updateData.public_submission_token = newToken;
          updateData.token_status = "active";
          updateData.token_created_at = new Date().toISOString();
        } else if (contract.token_status === "disabled") {
          updateData.token_status = "active";
        }
      } else {
        updateData.token_status = "disabled";
      }

      const { error } = await supabase
        .from("contracts")
        .update(updateData)
        .eq("id", contract.id);

      if (error) throw error;

      if (endDateReduced) {
        const d = new Date(newEndDate);
        const cutoffPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        const { data: toDelete } = await supabase
          .from("obligations")
          .select("id, status")
          .eq("contract_id", contract.id)
          .gt("period", cutoffPeriod);

        if (toDelete && toDelete.length > 0) {
          const deletableIds = toDelete
            .filter((o) => o.status !== "approved")
            .map((o) => o.id);

          if (deletableIds.length > 0) {
            await supabase.from("obligations").delete().in("id", deletableIds);
          }
        }
      }

      if (wasInactive && shouldBeActive) {
        toast({ title: "Contrato reactivado", description: "El contrato fue reactivado. Enlace de envío habilitado." });
      } else {
        toast({ title: "Contrato actualizado", description: "Los cambios se guardaron correctamente." });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating contract:", error);
      toast({ title: "Error", description: "No se pudo actualizar el contrato.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar contrato</DialogTitle>
        </DialogHeader>

        {hasRentDues && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Algunos campos están bloqueados porque este contrato ya tiene historial de alquiler.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="end_date">
              {isTemporario ? "Fecha de fin (check-out)" : "Fecha de vencimiento"}
            </Label>
            <Input id="end_date" type="date" {...register("end_date")} />
            {errors.end_date && (
              <p className="text-sm text-destructive">{errors.end_date.message}</p>
            )}
          </div>

          {isTemporario ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Los contratos temporarios no contemplan actualización de precio.
                </AlertDescription>
              </Alert>

              {/* Canal / Plataforma */}
              <div className="space-y-2">
                <Label>Canal / Plataforma de reserva</Label>
                <Controller
                  name="booking_channel"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={(v) => {
                      field.onChange(v);
                      if (v === "airbnb") setValue("deposit_mode", "platform_covered");
                      else if (watch("deposit_mode") === "platform_covered") setValue("deposit_mode", "required");
                    }} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BOOKING_CHANNELS.map((ch) => (
                          <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Modalidad de depósito */}
              <div className="space-y-2">
                <Label>Depósito / Garantía</Label>
                <Controller
                  name="deposit_mode"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={watchBookingChannel === "airbnb"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPOSIT_MODES.map((dm) => (
                          <SelectItem key={dm.value} value={dm.value}>{dm.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {watchDepositMode === "platform_covered" && (
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Garantía gestionada por la plataforma
                      {watchBookingChannel === "airbnb" ? " (Airbnb)" : watchBookingChannel === "booking" ? " (Booking.com)" : ""}.
                      No se requiere depósito en efectivo del inquilino.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Actualización de precio</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">¿El contrato tiene actualizaciones periódicas?</p>
                </div>
                <Switch
                  checked={!!watchHasPriceUpdate}
                  onCheckedChange={(v) => setValue("has_price_update", v)}
                  disabled={hasRentDues}
                />
              </div>

              {watchHasPriceUpdate && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Índice de actualización</Label>
                    <Select
                      value={selectedAdjustmentType}
                      onValueChange={(value) => setValue("adjustment_type", value)}
                      disabled={hasRentDues}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar índice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ipc">IPC — Índice de Precios al Consumidor</SelectItem>
                        <SelectItem value="icl">ICL — Índice Casa Propia</SelectItem>
                        <SelectItem value="fixed">Porcentaje fijo</SelectItem>
                        <SelectItem value="manual">Ajuste manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adjustment_frequency">Frecuencia (meses)</Label>
                    <Input
                      id="adjustment_frequency"
                      type="number"
                      min="1"
                      {...register("adjustment_frequency")}
                      disabled={hasRentDues}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="next_adjustment_date">Próxima fecha de ajuste</Label>
                    <Input id="next_adjustment_date" type="date" {...register("next_adjustment_date")} />
                  </div>
                </>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="clauses_text">Cláusulas adicionales / notas</Label>
            <Textarea
              id="clauses_text"
              placeholder="Condiciones especiales…"
              rows={4}
              {...register("clauses_text")}
            />
          </div>

          <div className="space-y-2">
            <Label>Idioma del formulario de pago (inquilino)</Label>
            <Select
              value={watch("submission_language")}
              onValueChange={(value) => setValue("submission_language", value)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
