'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Room, Tenant, Bill, Payment } from '../../types'
import { calculateRemainingBill } from '../../lib/billingUtils'

export default function AdminDashboard() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [roomsData, tenantsData, billsData, paymentsData] = await Promise.all([
        supabase.from('rooms').select('*'),
        supabase.from('tenants').select('*'),
        supabase.from('bills').select('*'),
        supabase.from('payments').select('*'),
      ])

      if (roomsData.data) setRooms(roomsData.data)
      if (tenantsData.data) setTenants(tenantsData.data)
      if (billsData.data) setBills(billsData.data)
      if (paymentsData.data) setPayments(paymentsData.data)

      setLoading(false)
    }
    fetchData()
  }, [])

  const totalRevenue = payments
    .filter(p => p.status === 'accepted')
    .reduce((sum, p) => sum + p.amount_paid, 0)

  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length
  const pendingBills = bills.filter(bill => {
    const remaining = calculateRemainingBill(bill, payments)
    return remaining > 0 && (bill.status === 'pending' || bill.status === 'partial' || bill.status === 'overdue')
  }).length
  const availableRooms = rooms.filter(r => r.status === 'available').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Total Rooms</h3>
          <p className="text-3xl font-bold text-gray-900">{rooms.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Occupied Rooms</h3>
          <p className="text-3xl font-bold text-gray-900">{occupiedRooms}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Pending Bills</h3>
          <p className="text-3xl font-bold text-red-600">{pendingBills}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Total Revenue</h3>
          <p className="text-3xl font-bold text-green-600">₱{totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Room Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">Available</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{availableRooms}</p>
                <p className="text-xs text-gray-500">{Math.round((availableRooms / rooms.length) * 100)}%</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">Occupied</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{occupiedRooms}</p>
                <p className="text-xs text-gray-500">{Math.round((occupiedRooms / rooms.length) * 100)}%</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">Maintenance</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {rooms.length - availableRooms - occupiedRooms}
                </p>
                <p className="text-xs text-gray-500">
                  {Math.round(((rooms.length - availableRooms - occupiedRooms) / rooms.length) * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Recent Payments</h3>
          {payments.slice(0, 5).map((payment) => (
            <div key={payment.id} className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Payment #{payment.id.slice(0, 8)}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(payment.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Recent Bills</h3>
          {bills.slice(0, 5).map((bill) => {
            const remaining = calculateRemainingBill(bill, payments)
            return (
              <div key={bill.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Bill #{bill.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Due: {new Date(bill.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₱{remaining.toFixed(2)}
                  </p>
                  <p className={`text-xs ${bill.status === 'pending' || bill.status === 'overdue' ? 'text-red-600' : 'text-green-600'}`}>
                    {bill.status}
                  </p>
                </div>
              </div>
            )
          })}
          {bills.length === 0 && (
            <p className="text-center text-gray-500 py-8">No bills yet</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Tenant Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Tenants</span>
              <span className="text-sm font-semibold text-gray-900">{tenants.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Tenants</span>
              <span className="text-sm font-semibold text-gray-900">{tenants.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg. Rent per Room</span>
              <span className="text-sm font-semibold text-green-600">
                ₱{(rooms.reduce((sum, room) => sum + (room.rent_amount || 0), 0) / rooms.length).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
