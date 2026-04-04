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

## Supabase — Proyecto de producción

- **Project ID**: rckpejobuhbupmxlxnit
- **Region**: South America (Sao Paulo) — sa-east-1
- **Tablas**: 32 tablas con RLS activo en todas
- **Multi-tenant**: todas las tablas tienen `project_id`
- **Roles**: owner, admin, collaborator, viewer
- **Storage buckets**: documents, proof-files, contract-documents
- **Edge Functions**: 7 funciones activas (generate-rent-dues, ensure-obligations,
  reconcile-proofs, get-public-contract, submit-payment-proof, serve-file, prepare-proof-upload)

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

## Estado del proyecto — al 4 de abril de 2026

- [x] Estructura base con Vite + React + TypeScript
- [x] Tailwind CSS + shadcn/ui configurados
- [x] Layout con sidebar y header responsive
- [x] Autenticación completa (login, registro, recuperación de contraseña)
- [x] i18n ES/EN con detección automática y switch manual
- [x] CRUD de Propiedades
- [x] 7 Edge Functions desplegadas en Supabase
- [x] Datos reales de producción migrados
- [ ] CRUD de Inquilinos
- [ ] Módulo de Contratos en menú + CRUD
- [ ] Módulo de Cobranza completo (mora + intereses automáticos)
- [ ] Módulo de Reparaciones completo (presupuesto + responsable)
- [ ] Módulo de Impuestos completo (vista anual)
- [ ] Módulo de Documentos (subida funcional + naming automático)
- [ ] Portal de Inquilino autenticado
- [ ] Reportes exportables (PDF y Excel)
- [ ] Comunicación propietario-inquilino
- [ ] Integración Mercado Pago
