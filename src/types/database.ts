// Tipos base de la base de datos Supabase
// Se actualizan a medida que se definen las tablas en Supabase

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      propiedades: {
        Row: {
          id: string
          usuario_id: string
          nombre: string
          direccion: string
          tipo: 'casa' | 'departamento' | 'local' | 'oficina' | 'otro'
          estado: 'disponible' | 'alquilada' | 'en_reparacion'
          descripcion: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['propiedades']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['propiedades']['Insert']>
      }
      inquilinos: {
        Row: {
          id: string
          usuario_id: string
          nombre: string
          apellido: string
          dni: string
          email: string | null
          telefono: string | null
          propiedad_id: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inquilinos']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inquilinos']['Insert']>
      }
      contratos: {
        Row: {
          id: string
          usuario_id: string
          propiedad_id: string
          inquilino_id: string
          fecha_inicio: string
          fecha_fin: string
          monto_mensual: number
          moneda: 'ARS' | 'USD'
          estado: 'activo' | 'vencido' | 'cancelado'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contratos']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['contratos']['Insert']>
      }
      pagos: {
        Row: {
          id: string
          usuario_id: string
          contrato_id: string
          periodo: string
          monto: number
          moneda: 'ARS' | 'USD'
          estado: 'pendiente' | 'pagado' | 'atrasado'
          fecha_pago: string | null
          observaciones: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['pagos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['pagos']['Insert']>
      }
      reparaciones: {
        Row: {
          id: string
          usuario_id: string
          propiedad_id: string
          titulo: string
          descripcion: string | null
          estado: 'pendiente' | 'en_progreso' | 'completada'
          prioridad: 'baja' | 'media' | 'alta'
          costo: number | null
          fecha_reporte: string
          fecha_resolucion: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['reparaciones']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['reparaciones']['Insert']>
      }
      impuestos: {
        Row: {
          id: string
          usuario_id: string
          propiedad_id: string
          tipo: string
          descripcion: string | null
          monto: number
          vencimiento: string
          estado: 'pendiente' | 'pagado' | 'vencido'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['impuestos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['impuestos']['Insert']>
      }
      documentos: {
        Row: {
          id: string
          usuario_id: string
          propiedad_id: string | null
          inquilino_id: string | null
          nombre: string
          tipo: string
          url: string
          tamaño: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['documentos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['documentos']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
