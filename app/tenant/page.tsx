'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Tenant, Room, Bill, Payment } from '../../types'
import { calculateTotalBill, calculateRemainingBill, calculateTotalPaid } from '../../lib/billingUtils'

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

      const [roomData, billsData, billItemsData, paymentsData] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', tenantData.room_id).single(),
        supabase.from('bills').select('*').eq('tenant_id', tenantData.id),
        supabase.from('bill_items').select('*'),
        supabase.from('payments').select('*').eq('tenant_id', tenantData.id),
      ])

      if (roomData.data) setRoom(roomData.data)
      if (billsData.data) {
        const billsWithItems = billsData.data.map(bill => {
          let items = billItemsData.data?.filter(item => item.bill_id === bill.id) || []
          const totalPaid = calculateTotalPaid(bill, paymentsData.data || [])
          const remaining = calculateRemainingBill(bill, paymentsData.data || [])

          // Dynamically calculate and update the remaining balance item based on actual payments
          // This ensures that even if the bill was generated earlier, the remaining balance is accurate
          const billDate = new Date(bill.due_date)
          const billMonth = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`
          
          // Get previous month's bill to calculate remaining balance
          const prevMonthDate = new Date(billDate.getFullYear(), billDate.getMonth(), 1)
          prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
          const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
          
          const previousBills = billsData.data.filter(b => {
            const bDate = new Date(b.due_date)
            const bMonth = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}`
            return b.tenant_id === bill.tenant_id && bMonth === prevMonth
          })

          if (previousBills.length > 0) {
            const previousBill = previousBills[0]
            const previousBillItems = billItemsData.data?.filter(item => item.bill_id === previousBill.id) || []
            const billWithItems = {
              ...previousBill,
              items: previousBillItems
            }
            
            const actualRemainingBalance = calculateRemainingBill(billWithItems, paymentsData.data || [])
            
            // Find existing remaining balance item in current bill
            const existingRemainingBalanceItem = items.find(item => item.item_type === 'remaining_balance')
            
            if (actualRemainingBalance !== 0) {
              // If actual remaining balance is different from what's stored, update it
              if (existingRemainingBalanceItem) {
                if (existingRemainingBalanceItem.amount !== actualRemainingBalance) {
                  existingRemainingBalanceItem.amount = actualRemainingBalance
                  existingRemainingBalanceItem.details = actualRemainingBalance > 0 
                    ? 'Remaining Balance from Previous Month' 
                    : 'Credit from Overpayment Last Month'
                }
              } else {
                // If there's no existing remaining balance item, add one
                items = [
                  ...items,
                  {
                    id: `temp-${Date.now()}-${bill.id}`,
                    bill_id: bill.id,
                    item_type: 'remaining_balance',
                    amount: actualRemainingBalance,
                    details: actualRemainingBalance > 0 
                      ? 'Remaining Balance from Previous Month' 
                      : 'Credit from Overpayment Last Month',
                    created_at: new Date().toISOString()
                  }
                ]
              }
            } else {
              // If remaining balance is now zero and there's an existing item, remove it
              if (existingRemainingBalanceItem) {
                items = items.filter(item => item.id !== existingRemainingBalanceItem.id)
              }
            }
          }

          // Recalculate bill amount based on current items
          const calculatedAmount = calculateTotalBill(items)
          
          return {
            ...bill,
            amount: calculatedAmount,
            items,
            totalPaid,
            remaining,
          }
        })
        setBills(billsWithItems)
      }
      if (paymentsData.data) setPayments(paymentsData.data)
    }

    setLoading(false)
  }

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  // Get current month's bill
  const currentMonthBill = bills.find(bill => {
    const billDate = new Date(bill.due_date)
    return billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear
  })

  // Calculate current month's total bill amount
  const currentMonthTotalBill = currentMonthBill 
    ? calculateTotalBill(currentMonthBill.items || [])
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Total Bill
          </h3>
          <p className="text-3xl font-bold text-blue-600">₱{currentMonthTotalBill.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">
            {currentMonthBill 
              ? `Status: ${currentMonthBill.status}`
              : 'No bill generated yet'
            }
          </p>
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
