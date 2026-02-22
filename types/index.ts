export type UserRole = 'admin' | 'tenant'

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  room_number: string
  type: string
  rent_amount: number
  status: 'available' | 'occupied' | 'maintenance'
  description?: string
  electric_meter_number?: string
  initial_electric_reading?: number
  electric_included?: boolean
  max_occupancy?: number
  deposit_amount?: number
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  user_id: string
  room_id: string
  name: string
  contact: string
  start_date: string
  emergency_contact_name: string
  emergency_contact_number: string
  created_at: string
  updated_at: string
}

export interface BillingRate {
  id: string
  month_year: string
  electricity_rate: number
  created_at: string
  updated_at: string
}

export interface ElectricReading {
  id: string
  room_id: string
  month_year: string
  reading: number
  created_at: string
  updated_at: string
}

export interface BillItem {
  id: string
  bill_id: string
  item_type: 'room_rent' | 'electricity' | 'remaining_balance'
  amount: number
  details?: string
  created_at: string
}

export interface Bill {
  id: string
  tenant_id: string
  room_id: string
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue' | 'partial'
  description?: string
  created_at: string
  updated_at: string
  items?: BillItem[]
  totalPaid?: number
  remaining?: number
  bill_period?: string
}

export interface Payment {
  id: string
  bill_id: string
  tenant_id: string
  amount_paid: number
  payment_date: string
  method: 'gcash' | 'bank' | 'in_person'
  reference_number?: string
  received_by?: string
  receipt_image?: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

export interface Deposit {
  id: string
  tenant_id: string
  room_id: string
  amount: number
  deposit_date: string
  refund_date?: string
  status: 'active' | 'refunded' | 'forfeited'
  method: 'gcash' | 'bank' | 'in_person'
  reference_number?: string
  received_by?: string
  receipt_image?: string
  notes?: string
  created_at: string
  updated_at: string
}