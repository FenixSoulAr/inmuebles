# MyRentaHub — Property Management Simplified

App web de gestión de propiedades en alquiler, construida en español.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 6 + TypeScript |
| UI | shadcn/ui + Tailwind CSS 3 |
| Backend / DB | Supabase (PostgreSQL + RLS) |
| Estado global | Zustand |
| Routing | React Router v7 |
| Íconos | lucide-react |

## Estructura de carpetas

```
src/
├── components/
│   ├── layout/        # AppLayout, Sidebar, Header
│   └── ui/            # Componentes shadcn/ui
├── hooks/             # Custom hooks (usePropiedad, usePagos, etc.)
├── lib/
│   ├── supabase.ts    # Cliente Supabase
│   └── utils.ts       # cn(), formatCurrency(), formatDate()
├── pages/
│   ├── Dashboard.tsx
│   ├── propiedades/
│   ├── inquilinos/
│   ├── cobranza/
│   ├── reparaciones/
│   ├── impuestos/
│   ├── documentos/
│   └── reportes/
├── routes/            # Router de react-router-dom
└── types/
    ├── database.ts    # Tipos generados de Supabase
    └── index.ts       # Re-exports y tipos derivados
```

## Módulos del sistema

1. **Propiedades** — CRUD de inmuebles (casa, dpto, local, oficina)
2. **Inquilinos** — Datos personales + contratos asociados
3. **Cobranza** — Registro y seguimiento de pagos mensuales
4. **Reparaciones** — Incidencias de mantenimiento con prioridad y estado
5. **Impuestos** — ABL, Ingresos Brutos y otros gravámenes por propiedad
6. **Documentos** — Archivos adjuntos almacenados en Supabase Storage
7. **Reportes** — Exportables en PDF y Excel (Cobranza, Rentabilidad, Ocupación, Reparaciones)

## Convenciones

- **Idioma**: Toda la UI y código en español (variables, tipos, rutas)
- **Moneda**: ARS por defecto, soporte USD. Usar `formatCurrency()` de `lib/utils.ts`
- **Fechas**: Formato `dd/mm/yyyy` argentino. Usar `formatDate()` de `lib/utils.ts`
- **Alias**: Usar `@/` en lugar de rutas relativas largas
- **Componentes UI**: Siempre usar shadcn/ui. No instalar otras librerías de UI sin discutir primero
- **Supabase RLS**: Toda tabla lleva `usuario_id` y políticas RLS para aislar datos por usuario

## Variables de entorno

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## Comandos

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
```

## Estado del proyecto

- [x] Estructura base con Vite + React + TypeScript
- [x] Tailwind CSS + shadcn/ui configurados
- [x] Layout con sidebar y header responsive
- [x] Páginas stub de los 7 módulos + Dashboard
- [x] Tipos base de base de datos definidos
- [ ] Autenticación con Supabase Auth
- [ ] CRUD de Propiedades
- [ ] CRUD de Inquilinos + Contratos
- [ ] Módulo de Cobranza con estados de pago
- [ ] Módulo de Reparaciones
- [ ] Módulo de Impuestos
- [ ] Módulo de Documentos (Supabase Storage)
- [ ] Reportes exportables
