'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Bill, Tenant, Room, BillItem, Payment } from '../../../types'
import { calculateTotalBill, calculateRemainingBill, calculateTotalPaid } from '../../../lib/billingUtils'

export default function TenantBillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    method: '',
    referenceNumber: '',
    receivedBy: '',
    amountPaid: 0,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    console.log('Fetching data...')
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      console.log('No session')
      setLoading(false)
      return
    }

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', sessionData.session.user.id)
      .single()

    console.log('Tenant data:', tenantData)

    if (tenantData) {
      setTenant(tenantData)

      const [roomData, billsData, billItemsData, paymentsData] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', tenantData.room_id).single(),
        supabase.from('bills').select('*').eq('tenant_id', tenantData.id),
        supabase.from('bill_items').select('*'),
        supabase.from('payments').select('*').eq('tenant_id', tenantData.id),
      ])

      console.log('Rooms data:', roomData)
      console.log('Bills data:', billsData)
      console.log('Bill items data:', billItemsData)
      console.log('Payments data:', paymentsData)

      if (roomData.data) setRoom(roomData.data)
      if (paymentsData.data) setPayments(paymentsData.data)
      if (billsData.data) {
        const billsWithItems = billsData.data.map(bill => {
          console.log('Processing bill:', bill)
          
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
          
          console.log('Total paid:', totalPaid)
          console.log('Remaining:', remaining)

          return {
            ...bill,
            amount: calculatedAmount,
            items,
            totalPaid,
            remaining,
          }
        })
        console.log('Setting bills with items:', billsWithItems)
        setBills(billsWithItems)
      }
    }

    setLoading(false)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBill) return

    try {
      // Create payment record
      const paymentData: any = {
        bill_id: selectedBill.id,
        tenant_id: tenant!.id,
        amount_paid: paymentForm.amountPaid || selectedBill.amount,
        payment_date: new Date().toISOString().split('T')[0],
        method: paymentForm.method,
        reference_number: paymentForm.referenceNumber,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (paymentForm.method === 'in_person') {
        paymentData.received_by = paymentForm.receivedBy
      }

      // Insert payment
      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData)

      if (paymentError) throw paymentError



      // Refresh data
      console.log('Refreshing data after payment...')
      await fetchData()
      console.log('Bills after refresh:', bills)
      setShowPaymentModal(false)
      setSelectedBill(null)
      setPaymentForm({
        method: '',
        referenceNumber: '',
        receivedBy: '',
        amountPaid: 0,
      })

      alert('Payment submitted successfully! It will be reviewed and approved by admin.')
    } catch (error) {
      console.error('Payment error:', error)
      alert('Failed to process payment. Please try again.')
    }
  }

  const handleMethodChange = (method: string) => {
    setPaymentForm(prev => ({
      ...prev,
      method,
      referenceNumber: '',
      receivedBy: '',
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Calculate summary statistics
  const calculateSummary = () => {
    const totalBills = bills.reduce((sum, bill) => sum + bill.amount, 0)
    const totalPaid = bills.reduce((sum, bill) => sum + (bill as any).totalPaid, 0)
    const totalRemaining = bills.reduce((sum, bill) => sum + (bill as any).remaining, 0)
    
    return {
      totalBills,
      totalPaid,
      totalRemaining,
    }
  }

  // Filter bills by current month and past months
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const currentMonthBills = bills.filter(bill => {
    const billDate = new Date(bill.due_date)
    return billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear
  })

  const pastMonthsBills = bills.filter(bill => {
    const billDate = new Date(bill.due_date)
    const billMonth = billDate.getMonth()
    const billYear = billDate.getFullYear()
    
    if (billYear < currentYear) {
      return true
    }
    if (billYear === currentYear && billMonth < currentMonth) {
      return true
    }
    return false
  })

  const summary = calculateSummary()

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">My Bills</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Bill Amount</dt>
                <dd className="text-lg font-medium text-gray-900">₱{summary.totalBills.toFixed(2)}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Paid</dt>
                <dd className="text-lg font-medium text-gray-900">₱{summary.totalPaid.toFixed(2)}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 ${summary.totalRemaining > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} rounded-full flex items-center justify-center`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Remaining Balance</dt>
                <dd className={`text-lg font-medium ${summary.totalRemaining > 0 ? 'text-red-600' : 'text-green-600'}`}>₱{summary.totalRemaining.toFixed(2)}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Current Month Bills */}
      {currentMonthBills.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Current Month - {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Room
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Bill
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                   {currentMonthBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {room?.room_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₱{(bill.items && bill.items.length > 0 
                          ? bill.items.reduce((sum, item) => sum + item.amount, 0) 
                          : bill.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₱{(bill as any).totalPaid?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-medium ₱{
                          calculateRemainingBill(bill, payments) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          ₱{calculateRemainingBill(bill, payments).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(bill.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ₱{
                          bill.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : bill.status === 'overdue'
                            ? 'bg-red-100 text-red-800'
                            : bill.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bill.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bill.items && bill.items.length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-sm text-blue-600 hover:text-blue-900">
                              View Items ({bill.items.length})
                            </summary>
                            <div className="mt-2 text-sm text-gray-600">
                              {bill.items.map((item, index) => {
                                // Calculate remaining balance per item based on payment allocation
                                const paymentAllocation = item.amount / bill.amount
                                const itemPaid = (bill as any).totalPaid * paymentAllocation
                                const itemRemaining = item.amount - itemPaid
                                
                                return (
                                  <div key={index} className="py-1">
                                    <strong>{item.item_type}:</strong> ₱{item.amount.toFixed(2)}
                                    <div className="text-xs text-gray-500">
                                      Paid: ₱{itemPaid.toFixed(2)} | Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span>
                                    </div>
                                    {item.details && (
                                      <div className="text-xs text-gray-500 mt-1">{item.details}</div>
                                    )}
                                  </div>
                                )
                              })}
                              <div className="border-t border-gray-200 mt-2 pt-2">
                                <strong>Total:</strong> ₱{bill.amount.toFixed(2)}
                                <div className="text-xs text-gray-500">
                                  Paid: ₱{(bill as any).totalPaid.toFixed(2)} | Remaining: <span className={(bill as any).remaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{(bill as any).remaining.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </details>
                        ) : (
                          <span className="text-gray-400 text-sm">No items</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bill.remaining !== undefined && bill.remaining > 0 && (
                            <button
                             onClick={() => {
                               setSelectedBill(bill)
                               setPaymentForm(prev => ({
                                 ...prev,
                                 amountPaid: bill.amount
                               }))
                               setShowPaymentModal(true)
                             }}
                             className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                           >
                             Pay Now
                           </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Past Months Bills */}
      {pastMonthsBills.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Past Months Bills</h3>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Room
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Bill
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                   {pastMonthsBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {room?.room_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₱{(bill.items && bill.items.length > 0 
                          ? bill.items.reduce((sum, item) => sum + item.amount, 0) 
                          : bill.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₱{(bill as any).totalPaid?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-medium ₱{
                          calculateRemainingBill(bill, payments) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          ₱{calculateRemainingBill(bill, payments).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(bill.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ₱{
                          bill.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : bill.status === 'overdue'
                            ? 'bg-red-100 text-red-800'
                            : bill.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bill.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bill.items && bill.items.length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-sm text-blue-600 hover:text-blue-900">
                              View Items ({bill.items.length})
                            </summary>
                            <div className="mt-2 text-sm text-gray-600">
                              {bill.items.map((item, index) => {
                                // Calculate remaining balance per item based on payment allocation
                                const paymentAllocation = item.amount / bill.amount
                                const itemPaid = (bill as any).totalPaid * paymentAllocation
                                const itemRemaining = item.amount - itemPaid
                                
                                return (
                                  <div key={index} className="py-1">
                                    <strong>{item.item_type}:</strong> ₱{item.amount.toFixed(2)}
                                    <div className="text-xs text-gray-500">
                                      Paid: ₱{itemPaid.toFixed(2)} | Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span>
                                    </div>
                                    {item.details && (
                                      <div className="text-xs text-gray-500 mt-1">{item.details}</div>
                                    )}
                                  </div>
                                )
                              })}
                              <div className="border-t border-gray-200 mt-2 pt-2">
                                <strong>Total:</strong> ₱{bill.amount.toFixed(2)}
                                <div className="text-xs text-gray-500">
                                  Paid: ₱{(bill as any).totalPaid.toFixed(2)} | Remaining: <span className={(bill as any).remaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{(bill as any).remaining.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </details>
                        ) : (
                          <span className="text-gray-400 text-sm">No items</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bill.remaining !== undefined && bill.remaining > 0 && (
                            <button
                             onClick={() => {
                               setSelectedBill(bill)
                               setPaymentForm(prev => ({
                                 ...prev,
                                 amountPaid: bill.amount
                               }))
                               setShowPaymentModal(true)
                             }}
                             className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                           >
                             Pay Now
                           </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bills.length === 0 && (
              <p className="text-center text-gray-500 py-8">No bills found</p>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-lg mx-4 my-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Pay Bill - ₱{selectedBill.amount.toFixed(2)}
            </h3>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="label">Amount to Pay</label>
                <div className="space-y-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.amountPaid || ''}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      amountPaid: e.target.value ? parseFloat(e.target.value) : 0
                    }))}
                    className="input-field"
                    required
                    placeholder="Enter amount"
                  />
                  <div className="text-sm text-gray-600">
                    Bill Amount: ₱{selectedBill?.amount.toFixed(2)}
                    {paymentForm.amountPaid > 0 && (
                      <span className="ml-2">
                        Remaining: ₱{(selectedBill!.amount - paymentForm.amountPaid).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Bill Items Breakdown */}
              {selectedBill.items && selectedBill.items.length > 0 && (
                <div>
                  <label className="label">Bill Breakdown</label>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {selectedBill.items.map((item, index) => {
                      const paymentAllocation = item.amount / selectedBill.amount
                      const itemPaid = (selectedBill as any).totalPaid * paymentAllocation
                      const itemRemaining = item.amount - itemPaid
                      const paymentAmountForItem = (paymentForm.amountPaid || selectedBill.amount) * paymentAllocation
                      const itemRemainingAfterPayment = itemRemaining - paymentAmountForItem

                      return (
                        <div key={index} className="text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{item.item_type}:</span>
                            <span>₱{item.amount.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Paid: ₱{itemPaid.toFixed(2)} | Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span>
                            {paymentForm.amountPaid > 0 && (
                              <span className="ml-2">
                                After Payment: <span className={itemRemainingAfterPayment > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemainingAfterPayment.toFixed(2)}</span>
                              </span>
                            )}
                          </div>
                          {item.details && (
                            <div className="text-xs text-gray-500 mt-1">{item.details}</div>
                          )}
                        </div>
                      )
                    })}
                    <div className="border-t border-gray-300 mt-2 pt-2">
                      <div className="flex justify-between font-medium">
                        <span>Total:</span>
                        <span>₱{selectedBill.amount.toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Paid: ₱{(selectedBill as any).totalPaid.toFixed(2)} | Remaining: <span className={(selectedBill as any).remaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{(selectedBill as any).remaining.toFixed(2)}</span>
                        {paymentForm.amountPaid > 0 && (
                          <span className="ml-2">
                            After Payment: <span className={(selectedBill as any).remaining - paymentForm.amountPaid > 0 ? 'text-red-600' : 'text-green-600'}>₱{((selectedBill as any).remaining - paymentForm.amountPaid).toFixed(2)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Payment Method</label>
                <div className="space-y-2">
                  {[
                    { value: 'gcash', label: 'GCash' },
                    { value: 'bank', label: 'Bank Transfer' },
                    { value: 'in_person', label: 'In Person' },
                  ].map((method) => (
                    <div key={method.value} className="flex items-center">
                      <input
                        type="radio"
                        id={method.value}
                        name="paymentMethod"
                        value={method.value}
                        checked={paymentForm.method === method.value}
                        onChange={() => handleMethodChange(method.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <label htmlFor={method.value} className="ml-2 block text-sm text-gray-700">
                        {method.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {paymentForm.method && paymentForm.method !== 'in_person' && (
                <div>
                  <label className="label">Reference Number</label>
                  <input
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      referenceNumber: e.target.value,
                    }))}
                    className="input-field"
                    required
                    placeholder="Enter reference number"
                  />
                </div>
              )}

              {paymentForm.method === 'in_person' && (
                <div>
                  <label className="label">Received By</label>
                  <input
                    type="text"
                    value={paymentForm.receivedBy}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      receivedBy: e.target.value,
                    }))}
                    className="input-field"
                    required
                    placeholder="Enter name of person who received payment"
                  />
                </div>
              )}



              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false)
                    setSelectedBill(null)
                    setPaymentForm({
                      method: '',
                      referenceNumber: '',
                      receivedBy: '',
                      amountPaid: 0,
                    })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors">
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
