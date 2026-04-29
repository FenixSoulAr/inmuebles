## Módulos del sistema

1. **Propiedades** — CRUD completo de inmuebles (casa, dpto, PH, local, oficina, depósito)
2. **Inquilinos** — Datos personales + contratos asociados
3. **Contratos** — Núcleo normativo: canon, ajustes IPC/ICL, servicios, cláusulas
4. **Cobranza** — Registro y seguimiento de pagos mensuales (rent_dues)
5. **Reparaciones** — Incidencias de mantenimiento con prioridad y estado
6. **Impuestos** — ABL, Inmobiliario, Rentas y otros gravámenes por propiedad
7. **Servicios** — Luz, Gas, Agua, Expensas con rendición de comprobantes
8. **Documentos** — Archivos adjuntos almacenados en Supabase Storage
9. **Reportes** — Exportables en PDF y Excel

## Convenciones

- **Idioma**: Toda la UI en español usando `t('key')` de react-i18next
- **Moneda**: ARS por defecto, soporte USD. Usar `formatCurrency()` de `lib/utils.ts`
- **Fechas**: Formato `dd/mm/yyyy` argentino. Usar `formatDate()` de `lib/utils.ts`
- **Alias**: Usar `@/` en lugar de rutas relativas largas
- **Componentes UI**: Siempre usar shadcn/ui. No instalar otras librerías de UI sin discutir primero
- **Supabase cliente**: Siempre importar desde `@/integrations/supabase/client`
- **Supabase RLS**: Toda tabla lleva `project_id` para aislamiento multi-tenant. NO usar `usuario_id`
- **Estado**: Usar Zustand para estado global. NO usar TanStack React Query (no está instalado)
- **Formularios**: React Hook Form + Zod para validación

## Modelo de cobros — invariante crítica

El sistema de cobros usa un **modelo dual** que debe preservarse siempre:

### Tablas y sus roles
- `rent_dues` — vencimientos financieros. Status: `pending` / `partial` / `paid` / `overdue`. Tiene `balance_due`.
- `obligations` con `kind='rent'` — flujo de notificación/comprobante. Status: `upcoming` / `awaiting_review` / `confirmed` / `pending_send`. **Espejo 1-a-1 de `rent_dues`** (matched por `contract_id` + `period` = `period_month`).
- `obligations` con `kind='service'` — generadas por la edge function `ensure-obligations` para servicios públicos.
- `rent_payments` — tabla legacy de pagos (FK a `rent_dues.id`). Mantener por compatibilidad.
- `payments` — tabla canónica de pagos (FK a `obligations.id`).

### Reglas FK (NO violar)
- `payment_proofs.obligation_id` → `obligations.id` ✅ (NUNCA `rent_dues.id`)
- `payments.obligation_id` → `obligations.id` ✅ (NUNCA `rent_dues.id`)
- Asignar un `rent_due.id` a estos campos causa **fallo silencioso** por FK violation.

### Helper canónico
Para resolver `obligation_id` desde un `rent_due` (creando la obligation si no existe), usar **siempre**:
```ts
import { resolveRentObligationId } from '@/lib/obligations'
```
Tanto el flujo de aprobación de comprobantes (`PendingProofs.tsx`) como el de pago manual (`useCobranza.registrarPago`) deben pasar por este helper.

### Vocabularios de status (NO confundir)
- `obligations.status`: `upcoming` / `awaiting_review` / `confirmed` / `pending_send`
- `rent_dues.status` y `tax_obligations.status`: `pending` / `partial` / `paid` / `overdue`

### Edge function
`generate-rent-dues v3` crea `rent_due` + `obligation` espejo (`kind='rent'`) en el mismo loop. NO modificar para que solo genere `rent_dues`.

### Backfill histórico
El 29-abr-2026 se aplicó la migración `backfill_rent_obligations_for_orphan_dues` que creó las obligations espejo faltantes. La invariante 1-a-1 ahora se cumple para todos los `rent_dues` existentes.

## Supabase — Proyecto de producción

- **Project ID**: rckpejobuhbupmxlxnit
- **Region**: South America (Sao Paulo) — sa-east-1
- **Tablas**: 32 tablas con RLS activo en todas
- **Multi-tenant**: todas las tablas tienen `project_id`
- **Roles**: owner, admin, collaborator, viewer
- **Storage buckets**: documents, proof-files, contract-documents
- **Edge Functions**: 8 funciones activas (generate-rent-dues v3, ensure-obligations, reconcile-proofs, get-public-contract, submit-payment-proof, serve-file, prepare-proof-upload, invite-tenant)

## Variables de entorno

```bash
VITE_SUPABASE_URL=https://rckpejobuhbupmxlxnit.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-publishable-key
```

## Comandos

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
```

## Estado del proyecto — al 29 de abril de 2026

- [x] Estructura base con Vite + React + TypeScript
- [x] Tailwind CSS + shadcn/ui configurados
- [x] Layout con sidebar y header responsive
- [x] Autenticación completa (login, registro, recuperación de contraseña)
- [x] i18n ES/EN con detección automática y switch manual
- [x] CRUD de Propiedades
- [x] CRUD de Inquilinos
- [x] Módulo de Contratos (incluye contratos rurales con frecuencia variable)
- [x] Módulo de Cobranza completo con FK obligation_id correcto
- [x] Módulo de Reparaciones (presupuesto + responsable)
- [x] Módulo de Impuestos (vista anual + lista filtrable + summary cards)
- [x] Módulo de Documentos (naming automático + storage)
- [x] Portal de Inquilino autenticado (Edge function `invite-tenant`)
- [x] 8 Edge Functions desplegadas en Supabase
- [x] Datos reales de producción migrados
- [x] Backfill de obligations rent espejo (29-abr-2026)
- [ ] Módulo de Servicios (UI — tablas existen)
- [ ] Módulo de Alertas (UI — tabla existe)
- [ ] Reportes exportables (PDF y Excel) — hoy solo placeholder
- [ ] Vista riesgo de mora + intereses automáticos en Cobranza
- [ ] Comunicación propietario-inquilino
- [ ] Integración Mercado Pago
