import { useState } from "react";
import { FileText, Copy, Printer, Wand2, Save, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/** A property owner record joined from property_owners → owners */
export interface OwnerForContract {
  full_name: string;
  dni_cuit?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  ownership_percent?: number | null;
}

/** A guarantor record from contract_guarantors */
export interface GuarantorForContract {
  guarantee_type: string;   // fiador_solidario | garantia_propietaria | seguro_caucion
  full_name?: string | null;
  company_name?: string | null;
  document_or_cuit?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  insurance_policy_number?: string | null;
  coverage_amount?: number | null;
  insurance_valid_from?: string | null;
  insurance_valid_to?: string | null;
  notes?: string | null;
  details?: Record<string, string> | null;
}

/** Minimal subset of contract data needed to build the text */
interface ContractForText {
  id: string;
  start_date: string;
  end_date: string;
  initial_rent: number;
  current_rent: number;
  deposit: number | null;
  currency: string | null;
  currency_deposit: string | null;
  rent_due_day: number | null;
  adjustment_type: string;
  adjustment_frequency: number | null;
  tipo_contrato?: string | null;
  usa_seguro?: boolean | null;
  seguro_tipo?: string | null;
  seguro_obligatorio?: boolean | null;
  expensas_ordinarias?: boolean | null;
  expensas_extraordinarias?: boolean | null;
  impuestos_a_cargo_locatario?: boolean | null;
  permite_subalquiler?: boolean | null;
  permite_mascotas?: boolean | null;
  basic_terms?: string | null;
  clauses_text?: string | null;
  /** Already saved text (from previous generation) */
  texto_contrato?: string | null;
  properties: { internal_identifier: string; full_address: string };
  tenants: { full_name: string; email: string | null; phone: string | null; doc_id?: string | null };
  /** Multiple owners from property_owners join */
  owners?: OwnerForContract[];
  /** Multiple guarantors from contract_guarantors */
  contractGuarantors?: GuarantorForContract[];
}

interface ContractTextPanelProps {
  contract: ContractForText;
  onSaved?: () => void;
}

// ── Label maps ────────────────────────────────────────────────────────────────
const ADJUSTMENT_LABELS: Record<string, string> = {
  ipc: "IPC (Índice de Precios al Consumidor)",
  icl: "ICL (Índice de Construcción / Casa Propia)",
  fixed: "Porcentaje fijo pactado",
  manual: "Ajuste manual convenido entre partes",
  uva: "UVA (Unidad de Valor Adquisitivo)",
  other: "Otro índice convenido",
};

const FREQ_LABELS: Record<number, string> = {
  1: "mensualmente",
  3: "trimestralmente",
  4: "cuatrimestralmente",
  6: "semestralmente",
  12: "anualmente",
};

const TIPO_LABELS: Record<string, string> = {
  vivienda: "Vivienda / Habitacional",
  comercial: "Comercial",
  temporal: "Temporal / Turístico",
};

const SEGURO_LABELS: Record<string, string> = {
  incendio: "Seguro contra incendio",
  caucion: "Seguro de caución",
  integral: "Seguro integral de inquilinos",
};

const NUM_WORDS: Record<number, string> = {
  1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
  6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez",
  15: "quince", 20: "veinte", 25: "veinticinco", 28: "veintiocho",
};

const numWord = (n: number) => NUM_WORDS[n] ?? String(n);

// ── Contract text builder ─────────────────────────────────────────────────────
function buildContractText(c: ContractForText): string {
  const rentCurr = c.currency || "ARS";
  const depCurr = c.currency_deposit || "ARS";
  const locale = "es-AR";

  const fmt = (amount: number, curr: string) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 0,
    }).format(amount);

  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const today = new Date().toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const tipoLabel = TIPO_LABELS[c.tipo_contrato || "vivienda"] || "Vivienda";
  const adjLabel = ADJUSTMENT_LABELS[c.adjustment_type] || c.adjustment_type;
  const freqLabel = FREQ_LABELS[c.adjustment_frequency || 12] || `cada ${c.adjustment_frequency} meses`;

  const expOrd = c.expensas_ordinarias ?? true;
  const expExt = c.expensas_extraordinarias ?? false;
  const impLoc = c.impuestos_a_cargo_locatario ?? false;
  const subalq = c.permite_subalquiler ?? false;
  const mascotas = c.permite_mascotas ?? false;
  const usaSeg = c.usa_seguro ?? false;
  const segTipo = c.seguro_tipo ? (SEGURO_LABELS[c.seguro_tipo] || c.seguro_tipo) : "Seguro de caución";
  const segOblig = c.seguro_obligatorio ?? true;
  const dueDay = c.rent_due_day || 5;

  const owners = c.owners ?? [];
  const guarantors = c.contractGuarantors ?? [];

  // Build locador block — single or multiple
  const locadorLabel = owners.length > 1 ? "LOCADORES (Co-propietarios)" : "LOCADOR (Propietario)";
  const locadorBlock = owners.length > 0
    ? owners.map((o, i) => `${owners.length > 1 ? `  [${i + 1}] ` : "  "}Nombre: ${o.full_name}${o.ownership_percent != null ? ` (${o.ownership_percent}%)` : ""}
  DNI / CUIT: ${o.dni_cuit || "____________________________________________"}
  Domicilio real: ${o.address || "___________________________________________________"}
  Correo electrónico: ${o.email || "________________________________________________"}
  Teléfono: ${o.phone || "__________________________________________________________"}`).join("\n\n")
    : `  Nombre / Razón Social: ____________________________________________
  DNI / CUIT: _______________________________________________________
  Domicilio real: ___________________________________________________
  Domicilio constituido (electrónico): _______________________________
  Correo electrónico: ________________________________________________
  Teléfono: __________________________________________________________`;

  // ── Guarantee clause builder ───────────────────────────────────────────────
  const fiadores = guarantors.filter(g => g.guarantee_type === "fiador_solidario");
  const propietarios = guarantors.filter(g => g.guarantee_type === "garantia_propietaria");
  const seguros = guarantors.filter(g => g.guarantee_type === "seguro_caucion");

  // Build Cláusula 12 content dynamically
  const buildGuaranteeClause = (): string => {
    if (guarantors.length === 0) {
      return `El contrato no cuenta con garantía al momento de la firma. Las partes
podrán acordar garantías adicionales mediante instrumento separado que
formará parte integrante del presente contrato.`;
    }

    const sections: string[] = [];

    // A) FIADOR SOLIDARIO
    if (fiadores.length > 0) {
      const isMultiple = fiadores.length > 1;
      const heading = isMultiple
        ? `A) FIADORES SOLIDARIOS (${fiadores.length} garantes)`
        : "A) FIADOR SOLIDARIO";
      const legalText = `El/Los FIADOR/ES que se identifica/n a continuación actúa/n en carácter de
fiador/es solidario/s, liso/s, llano/s y principal/es pagador/es, con renuncia
expresa a los beneficios de excusión y división (art. 1590 CCyCN), obligándose
al cumplimiento íntegro de todas las obligaciones emergentes del presente
contrato en caso de incumplimiento del LOCATARIO.`;

      const list = fiadores.map((g, i) => {
        const name = g.full_name || "___________________________________________";
        return `${isMultiple ? `  [${i + 1}] ` : "  "}Nombre y Apellido: ${name}
  DNI / CUIT: ${g.document_or_cuit || "____________________________________________"}
  Domicilio real: ${g.address || "________________________________________________"}
  Teléfono: ${g.phone || "___________________________________________________"}
  Correo electrónico: ${g.email || "____________________________________________"}${g.notes ? `\n  Observaciones: ${g.notes}` : ""}`;
      }).join("\n\n");

      sections.push(`${heading}\n\n${legalText}\n\n${list}`);
    }

    // B) GARANTÍA PROPIETARIA
    if (propietarios.length > 0) {
      const isMultiple = propietarios.length > 1;
      const heading = isMultiple
        ? `B) GARANTÍA PROPIETARIA (${propietarios.length} garantes)`
        : "B) GARANTÍA PROPIETARIA";
      const legalText = `El/Los garante/s propietario/s que se identifica/n a continuación ofrece/n
como garantía real un inmueble de su propiedad, libre de gravámenes, embargos
e inhibiciones, cuya descripción y datos registrales se detallan a continuación.
El garante se obliga solidariamente con el LOCATARIO al cumplimiento de todas
las obligaciones emergentes del presente contrato.`;

      const list = propietarios.map((g, i) => {
        const name = g.full_name || g.company_name || "___________________________________________";
        const det = (g.details as Record<string, string> | null) ?? {};
        return `${isMultiple ? `  [${i + 1}] ` : "  "}Titular del inmueble: ${name}
  DNI / CUIT: ${g.document_or_cuit || "____________________________________________"}
  Domicilio del garante: ${g.address || "________________________________________"}
  Inmueble en garantía — Dirección: ${det.direccion_inmueble || g.address || "_______________________"}
  Matrícula / Folio Real: ${det.matricula || "____________________________________"}
  Partido / Sección: ${det.partido || "__________________________________________"}
  Nomenclatura catastral: ${det.nomenclatura || "_________________________________"}${g.notes ? `\n  Observaciones: ${g.notes}` : ""}`;
      }).join("\n\n");

      sections.push(`${heading}\n\n${legalText}\n\n${list}`);
    }

    // C) SEGURO DE CAUCIÓN
    if (seguros.length > 0) {
      const isMultiple = seguros.length > 1;
      const heading = isMultiple
        ? `C) SEGURO DE CAUCIÓN (${seguros.length} pólizas)`
        : "C) SEGURO DE CAUCIÓN";
      const legalText = `En sustitución de garantía personal, el LOCATARIO presenta seguro/s de caución
emitido/s por una compañía aseguradora habilitada por la Superintendencia de
Seguros de la Nación, con las coberturas y vigencias que se detallan a continuación.
La póliza cubre el fiel cumplimiento de las obligaciones del LOCATARIO
emergentes del presente contrato.`;

      const list = seguros.map((g, i) => {
        const currency = (g.details as Record<string, string> | null)?.currency || "ARS";
        const vigDesde = g.insurance_valid_from
          ? new Date(g.insurance_valid_from + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
          : "____/____/____";
        const vigHasta = g.insurance_valid_to
          ? new Date(g.insurance_valid_to + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
          : "____/____/____";
        return `${isMultiple ? `  [${i + 1}] ` : "  "}Aseguradora / Compañía: ${g.company_name || "___________________________________________"}
  Número de póliza: ${g.insurance_policy_number || "______________________________________"}
  Monto de cobertura: ${g.coverage_amount != null ? fmt(g.coverage_amount, currency) + ` (${currency})` : "____________________________________________"}
  Vigencia desde: ${vigDesde}
  Vigencia hasta: ${vigHasta}${g.notes ? `\n  Observaciones: ${g.notes}` : ""}`;
      }).join("\n\n");

      sections.push(`${heading}\n\n${legalText}\n\n${list}`);
    }

    return sections.join("\n\n" + "─".repeat(60) + "\n\n");
  };

  // Signature block for guarantors
  const buildGuarantorSignatureBlock = (): string => {
    if (guarantors.length === 0) {
      return "  (Sin garantes al momento de la firma)";
    }

    return guarantors.map((g, i) => {
      const typeLabel =
        g.guarantee_type === "fiador_solidario" ? "FIADOR SOLIDARIO"
        : g.guarantee_type === "garantia_propietaria" ? "GARANTE PROPIETARIO"
        : "GARANTE — SEGURO DE CAUCIÓN";
      const name = g.full_name || g.company_name || "";
      const docId = g.document_or_cuit || "";

      if (g.guarantee_type === "seguro_caucion") {
        return `${guarantors.length > 1 ? `[${i + 1}] ` : ""}${typeLabel}

_________________________________
Aseguradora: ${g.company_name || "______________________"}
Póliza N°: ${g.insurance_policy_number || "________________"}
Vigencia hasta: ${g.insurance_valid_to || "________________"}`;
      }

      return `${guarantors.length > 1 ? `[${i + 1}] ` : ""}${typeLabel}

_________________________________
Nombre: ${name || "_______________________"}
DNI / CUIT: ${docId || "___________________"}
Aclaración:
Fecha:`;
    }).join("\n\n");
  };

  return `\
═══════════════════════════════════════════════════════════════════════
                    CONTRATO DE LOCACIÓN
         Código Civil y Comercial de la Nación Argentina
═══════════════════════════════════════════════════════════════════════

En la Ciudad Autónoma de Buenos Aires, a los ${today}, entre las partes que se
identifican a continuación, se celebra el presente CONTRATO DE LOCACIÓN,
conforme las disposiciones del Código Civil y Comercial de la Nación
(Ley 26.994) y normativa complementaria vigente.

───────────────────────────────────────────────────────────────────────
PARTES CONTRATANTES
───────────────────────────────────────────────────────────────────────

${locadorLabel}:
${locadorBlock}

LOCATARIO (Inquilino):
  Nombre: ${c.tenants.full_name}
  DNI / CUIT: ${c.tenants.doc_id || "____________________________________________"}
  Domicilio real: ___________________________________________________
  Domicilio constituido: ${c.properties.full_address}
${c.tenants.email ? `  Correo electrónico: ${c.tenants.email}` : "  Correo electrónico: ____________________________________________"}
${c.tenants.phone ? `  Teléfono: ${c.tenants.phone}` : "  Teléfono: __________________________________________________"}

───────────────────────────────────────────────────────────────────────
CLÁUSULA 1ª — OBJETO DEL CONTRATO
───────────────────────────────────────────────────────────────────────

El LOCADOR da en locación al LOCATARIO el inmueble ubicado en:

  Dirección: ${c.properties.full_address}
  Identificador interno: ${c.properties.internal_identifier}

El LOCATARIO declara conocer el estado del inmueble, habiéndolo visitado
y aceptado en las condiciones en que se encuentra.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 2ª — DESTINO
───────────────────────────────────────────────────────────────────────

El inmueble se destina exclusivamente a uso: ${tipoLabel.toUpperCase()}.

Queda expresamente ${subalq
  ? "PERMITIDO el subalquiler con autorización escrita previa y expresa del LOCADOR"
  : "PROHIBIDO subalquilar, ceder, transferir o en cualquier forma subcontratar el presente contrato"
}, total o parcialmente, sin autorización expresa y escrita del LOCADOR.

El LOCATARIO ${mascotas
  ? "PODRÁ tener mascotas domésticas en el inmueble, siendo exclusivamente responsable de cualquier daño, deterioro o inconveniente que éstas ocasionen"
  : "NO podrá tener mascotas ni animales de ningún tipo en el inmueble"
}.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 3ª — PLAZO
───────────────────────────────────────────────────────────────────────

El plazo del presente contrato se fija en _______ (___) años, con vigencia:

  Fecha de inicio:      ${fmtDate(c.start_date)}
  Fecha de vencimiento: ${fmtDate(c.end_date)}

Transcurrido dicho plazo, el LOCATARIO deberá restituir el inmueble libre
de ocupantes y bienes, sin necesidad de interpelación previa. La continuidad
en el uso una vez vencido el plazo no importará renovación tácita del contrato.
${c.tipo_contrato === "temporal" ? `
Por tratarse de una locación TEMPORAL (art. 1223 CCyCN), la causa transitoria
que justifica el presente convenio es: __________________________________.
El plazo máximo de este contrato es de tres (3) meses.
` : ""}
───────────────────────────────────────────────────────────────────────
CLÁUSULA 4ª — PRECIO Y FORMA DE PAGO
───────────────────────────────────────────────────────────────────────

El precio inicial de la locación se fija en:

  ${fmt(c.initial_rent, rentCurr)} (${rentCurr}) mensuales.

El canon locativo deberá abonarse por período adelantado, dentro de los
primeros ${dueDay} (${numWord(dueDay)}) días corridos de cada mes, mediante
transferencia bancaria a la cuenta que indique el LOCADOR, o por el medio
que acuerden las partes en instrumento separado.

La mora en el pago operará de pleno derecho, sin necesidad de interpelación
judicial ni extrajudicial, al día siguiente al vencimiento del plazo establecido.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 5ª — ACTUALIZACIÓN DEL PRECIO (INDEXACIÓN)
───────────────────────────────────────────────────────────────────────

El precio del alquiler se actualizará ${freqLabel}, según el siguiente índice:

  ${adjLabel}

Cada actualización será notificada fehacientemente al LOCATARIO con una
antelación mínima de quince (15) días hábiles a la fecha de vigencia.
El nuevo valor reemplaza al anterior a partir del período siguiente a
la notificación. Las actualizaciones se realizarán conforme a la normativa
vigente en materia de locaciones urbanas.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 6ª — DEPÓSITO DE GARANTÍA
───────────────────────────────────────────────────────────────────────

${c.deposit != null
  ? `En concepto de depósito en garantía, el LOCATARIO entrega al LOCADOR la
suma de:

  ${fmt(c.deposit, depCurr)} (${depCurr})

equivalente a _____ (___) meses de alquiler inicial, en carácter de garantía
por el fiel cumplimiento de las obligaciones asumidas en el presente contrato.

Dicha suma será devuelta al LOCATARIO dentro de los treinta (30) días
posteriores a la restitución del inmueble en las condiciones pactadas,
deduciéndose los importes correspondientes a daños, reparaciones, deudas
pendientes de servicios, expensas o cualquier otro incumplimiento comprobado.`
  : `El depósito de garantía podrá ser acordado entre las partes en instrumento
separado, que formará parte integrante del presente contrato.`}

───────────────────────────────────────────────────────────────────────
CLÁUSULA 7ª — EXPENSAS, IMPUESTOS Y SERVICIOS
───────────────────────────────────────────────────────────────────────

Se establece la siguiente distribución de gastos:

  • Expensas ordinarias del consorcio:       a cargo del ${expOrd ? "LOCATARIO" : "LOCADOR"}
  • Expensas extraordinarias del consorcio:  a cargo del ${expExt ? "LOCATARIO" : "LOCADOR"}
  • Impuestos que afecten al inmueble
    (ABL, Rentas, AGIP, etc.):               a cargo del ${impLoc ? "LOCATARIO" : "LOCADOR"}
  • Servicios básicos (electricidad, gas,
    agua corriente, internet, teléfono):     a cargo del LOCATARIO
  • Mantenimiento de artefactos e
    instalaciones menores (reparaciones
    locativas):                              a cargo del LOCATARIO

───────────────────────────────────────────────────────────────────────
CLÁUSULA 8ª — SEGURO
───────────────────────────────────────────────────────────────────────

${usaSeg
  ? `El LOCATARIO deberá contratar y mantener vigente durante toda la duración
del contrato, un seguro del siguiente tipo:

  ${segTipo}

El seguro deberá:
  a) Estar endosado a nombre del LOCADOR como beneficiario o asegurado adicional;
  b) Presentarse póliza original o copia certificada al inicio del contrato;
  c) Renovarse anualmente y acreditarse ante el LOCADOR con 15 días de anticipación.

La contratación de dicho seguro es ${segOblig
    ? "OBLIGATORIA y condición esencial del contrato. Su incumplimiento dará derecho al LOCADOR a rescindir el contrato"
    : "recomendada por las partes"}.

En caso de no renovar el seguro en término, el LOCADOR podrá contratarlo
por cuenta y cargo del LOCATARIO, debitándose el costo del primer canon
locativo inmediato.`
  : `Las partes podrán acordar la contratación de seguros y garantías adicionales
en instrumento separado que formará parte integrante del presente contrato.`}

───────────────────────────────────────────────────────────────────────
CLÁUSULA 9ª — CONSERVACIÓN Y USO DEL INMUEBLE
───────────────────────────────────────────────────────────────────────

El LOCATARIO se obliga a:

  a) Usar el inmueble en forma ordenada, pacífica y conforme a su destino;
  b) Conservarlo en buen estado y realizar las reparaciones locativas que
     correspondan (art. 1207 CCyCN);
  c) Comunicar fehacientemente al LOCADOR todo deterioro o daño significativo
     dentro de las cuarenta y ocho (48) horas de conocerlo;
  d) Permitir el acceso del LOCADOR o sus representantes para inspecciones,
     con previo aviso de cuarenta y ocho (48) horas;
  e) No realizar modificaciones, refacciones o mejoras sin autorización
     escrita del LOCADOR; las mejoras autorizadas quedarán en beneficio
     del inmueble sin derecho a indemnización, salvo pacto en contrario.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 10ª — MORA Y PENALIDADES
───────────────────────────────────────────────────────────────────────

La mora del LOCATARIO en el pago del canon locativo operará automáticamente,
sin necesidad de interpelación judicial ni extrajudicial, a partir del día
siguiente al vencimiento del plazo establecido en la Cláusula 4ª.

El incumplimiento en el pago de dos (2) o más períodos consecutivos dará
derecho al LOCADOR a:
  a) Considerar el contrato rescindido por culpa del LOCATARIO;
  b) Iniciar las acciones legales de cobro y/o desalojo pertinentes;
  c) Retener el depósito de garantía hasta la liquidación final de la deuda.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 11ª — RESTITUCIÓN DEL INMUEBLE
───────────────────────────────────────────────────────────────────────

Al vencimiento del contrato, o ante cualquier causa que lo extinga,
el LOCATARIO deberá:

  a) Desalojar el inmueble y restituirlo al LOCADOR libre de personas,
     bienes y en el mismo estado en que lo recibió, salvo el desgaste
     normal por el uso;
  b) Entregar la totalidad de llaves, tarjetas de acceso y dispositivos
     de seguridad asociados al inmueble;
  c) Cancelar todos los servicios domiciliarios a su nombre;
  d) Saldar las deudas pendientes de expensas, impuestos y servicios.

La demora en la restitución devengará, sin perjuicio de las acciones
legales que correspondan, una compensación equivalente al doble del valor
diario del canon locativo vigente por cada día de retardo.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 12ª — GARANTÍAS
───────────────────────────────────────────────────────────────────────

${buildGuaranteeClause()}

───────────────────────────────────────────────────────────────────────
CLÁUSULA 13ª — RESCISIÓN ANTICIPADA
───────────────────────────────────────────────────────────────────────

El LOCATARIO podrá rescindir anticipadamente el presente contrato,
debiendo notificar fehacientemente al LOCADOR con una antelación mínima
de sesenta (60) días corridos.

Si la rescisión opera antes de transcurrido el primer año de locación,
corresponde el pago de la indemnización prevista en el artículo 1221
del CCyCN. Pasado el primer año, no corresponde indemnización, siempre
que se respete el preaviso establecido.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 14ª — DOMICILIOS ELECTRÓNICOS
───────────────────────────────────────────────────────────────────────

Las partes constituyen domicilios electrónicos donde serán válidas todas
las notificaciones relacionadas con el presente contrato:

  LOCADOR:    ________________________________________________________
  LOCATARIO:  ${c.tenants.email || "_______________________________________________"}

Toda comunicación deberá realizarse mediante correo electrónico o
plataforma digital fehaciente, conservando constancia del envío y recepción.

───────────────────────────────────────────────────────────────────────
CLÁUSULA 15ª — JURISDICCIÓN Y COMPETENCIA
───────────────────────────────────────────────────────────────────────

Para todos los efectos legales del presente contrato, las partes se
someten a la jurisdicción de los Tribunales Ordinarios Competentes
de la Ciudad Autónoma de Buenos Aires, renunciando expresamente a
cualquier otro fuero o jurisdicción que pudiera corresponderles.
${c.basic_terms ? `
───────────────────────────────────────────────────────────────────────
CLÁUSULA 16ª — CONDICIONES BÁSICAS PACTADAS
───────────────────────────────────────────────────────────────────────

${c.basic_terms}
` : ""}${c.clauses_text ? `
───────────────────────────────────────────────────────────────────────
CLÁUSULA ADICIONAL — CONDICIONES ESPECIALES
───────────────────────────────────────────────────────────────────────

${c.clauses_text}
` : ""}
═══════════════════════════════════════════════════════════════════════
FIRMAS Y CONFORMIDAD
═══════════════════════════════════════════════════════════════════════

Leído el presente contrato y conformes las partes con su contenido,
se firman _____ (___) ejemplares de un mismo tenor y a un solo efecto.


LOCADOR:                                    LOCATARIO:

_________________________________           _________________________________
Nombre:                                     Nombre: ${c.tenants.full_name}
DNI:                                        DNI: ${c.tenants.doc_id || "_________________"}
Aclaración:                                 Aclaración:
Fecha:                                      Fecha:


GARANTES:

${buildGuarantorSignatureBlock()}


═══════════════════════════════════════════════════════════════════════
Documento generado el ${today}
Propiedad: ${c.properties.internal_identifier} — ${c.properties.full_address}
Este documento es un modelo orientativo. Consulte a un profesional
jurídico antes de firmar.
═══════════════════════════════════════════════════════════════════════`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ContractTextPanel({ contract, onSaved }: ContractTextPanelProps) {
  const { toast } = useToast();
  const [text, setText] = useState<string>(contract.texto_contrato || "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasText = text.trim().length > 0;

  const handleGenerate = () => {
    setGenerating(true);
    try {
      const generated = buildContractText(contract);
      setText(generated);
      toast({ title: "Texto generado", description: "Revisá y ajustá el texto antes de firmar." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo generar el texto.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!hasText) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copiado", description: "Texto del contrato copiado al portapapeles." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Error", description: "No se pudo copiar al portapapeles.", variant: "destructive" });
    }
  };

  const handlePrint = () => {
    if (!hasText) return;
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Bloqueado", description: "El navegador bloqueó la ventana emergente. Permitila para exportar.", variant: "destructive" });
      return;
    }
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Contrato de Locación — ${contract.properties.internal_identifier}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 10.5px;
      line-height: 1.65;
      color: #111;
      background: #fff;
      padding: 2.5cm 2cm;
    }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    @media print {
      body { padding: 0; }
      @page { size: A4; margin: 2cm 1.8cm; }
    }
  </style>
</head>
<body>
<pre>${escaped}</pre>
<script>
  window.onload = function() {
    window.print();
  };
</script>
</body>
</html>`);
    win.document.close();
  };

  const handleSave = async () => {
    if (!hasText) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("contracts")
        .update({ texto_contrato: text } as any)
        .eq("id", contract.id);
      if (error) throw error;
      toast({ title: "Guardado", description: "Texto guardado en el registro del contrato." });
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar el texto.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4" />
            Texto del contrato
            {hasText && (
              <Badge variant="secondary" className="text-xs ml-1">Generado</Badge>
            )}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleGenerate}
              disabled={generating}
            >
              <Wand2 className="w-3.5 h-3.5 mr-1.5" />
              {hasText ? "Regenerar" : "Generar texto"}
            </Button>
            {hasText && (
              <>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied
                    ? <><CheckCheck className="w-3.5 h-3.5 mr-1.5 text-success" />Copiado</>
                    : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copiar</>
                  }
                </Button>
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Exportar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasText ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
            <FileText className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Aún no se generó el texto del contrato
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Hacé clic en "Generar texto" para crear el contrato completo basado en los datos registrados.
            </p>
            <Button size="sm" className="mt-4" onClick={handleGenerate}>
              <Wand2 className="w-3.5 h-3.5 mr-1.5" />
              Generar texto ahora
            </Button>
          </div>
        ) : (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs leading-relaxed min-h-[500px] resize-y bg-muted/20"
            aria-label="Texto del contrato"
          />
        )}
        {hasText && (
          <p className="text-xs text-muted-foreground mt-2">
            Podés editar el texto directamente en el área de arriba antes de copiar o exportar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
