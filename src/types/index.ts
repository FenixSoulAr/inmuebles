export type { Database } from './database'

// Tipos derivados de la DB para uso en la UI
import type { Database } from './database'

type Tables = Database['public']['Tables']

export type Propiedad = Tables['propiedades']['Row']
export type PropiedadInsert = Tables['propiedades']['Insert']
export type PropiedadUpdate = Tables['propiedades']['Update']

export type Inquilino = Tables['inquilinos']['Row']
export type InquilinoInsert = Tables['inquilinos']['Insert']
export type InquilinoUpdate = Tables['inquilinos']['Update']

export type Contrato = Tables['contratos']['Row']
export type ContratoInsert = Tables['contratos']['Insert']
export type ContratoUpdate = Tables['contratos']['Update']

export type Pago = Tables['pagos']['Row']
export type PagoInsert = Tables['pagos']['Insert']
export type PagoUpdate = Tables['pagos']['Update']

export type Reparacion = Tables['reparaciones']['Row']
export type ReparacionInsert = Tables['reparaciones']['Insert']
export type ReparacionUpdate = Tables['reparaciones']['Update']

export type Impuesto = Tables['impuestos']['Row']
export type ImpuestoInsert = Tables['impuestos']['Insert']
export type ImpuestoUpdate = Tables['impuestos']['Update']

export type Documento = Tables['documentos']['Row']
export type DocumentoInsert = Tables['documentos']['Insert']
export type DocumentoUpdate = Tables['documentos']['Update']
