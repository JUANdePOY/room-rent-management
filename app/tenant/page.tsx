'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Tenant, Room, Bill, Payment } from '../../types'

export default function TenantDashboard() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setLoading(false)
      return
    }

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (tenantData) {
      setTenant(tenantData)

      const [roomData, billsData, paymentsData] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', tenantData.room_id).single(),
        supabase.from('bills').select('*').eq('tenant_id', tenantData.id),
        supabase.from('payments').select('*').eq('tenant_id', tenantData.id),
      ])

      if (roomData.data) setRoom(roomData.data)
      if (billsData.data) setBills(billsData.data)
      if (paymentsData.data) setPayments(paymentsData.data)
    }

    setLoading(false)
  }

  const pendingBills = bills.filter(b => (b.remaining || 0) > 0)
  const totalPending = pendingBills.reduce((sum, b) => sum + b.amount, 0)
  const totalPaid = payments.filter(p => p.status === 'accepted').reduce((sum, p) => sum + p.amount_paid, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Total Rent</h3>
          <p className="text-3xl font-bold text-blue-600">₱{room?.rent_amount.toFixed(2) || '0.00'}</p>
          <p className="text-sm text-gray-500 mt-1">Per Month</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Pending Bills</h3>
          <p className="text-3xl font-bold text-yellow-600">₱{totalPending.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">{pendingBills.length} Bills</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Total Paid</h3>
          <p className="text-3xl font-bold text-green-600">₱{totalPaid.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">This Year</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">My Room</h3>
          {room ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Room Number:</span>
                <span className="font-medium">{room.room_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">{room.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ₱{
                  room.status === 'available'
                    ? 'bg-green-100 text-green-800'
                    : room.status === 'occupied'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {room.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rent Amount:</span>
                <span className="font-medium">₱{room.rent_amount.toFixed(2)}</span>
              </div>
              {room.description && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-600">{room.description}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">You are not assigned to any room</p>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Recent Payments</h3>
          {payments.slice(0, 5).map((payment) => (
            <div key={payment.id} className="flex justify-between items-center py-2 border-b">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Payment #{payment.id.slice(0, 8)}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(payment.payment_date).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm font-semibold text-green-600">
                ₱{payment.amount_paid.toFixed(2)}
              </p>
            </div>
          ))}
          {payments.length === 0 && (
            <p className="text-center text-gray-500 py-8">No payments yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
