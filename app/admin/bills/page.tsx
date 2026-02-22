'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Bill, Tenant, Room, BillItem, Payment, ElectricReading, BillingRate } from '../../../types'
import { 
  calculateTotalBill, 
  calculateRemainingBill, 
  calculateTotalPaid,
  calculateAdminBillingSummary,
  calculateMonthlyAdminSummary
} from '../../../lib/billingUtils'
import { calculateAccurateBillingSummary } from '../../../lib/accurateBillingUtils'

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [electricReadings, setElectricReadings] = useState<ElectricReading[]>([])
  const [billingRates, setBillingRates] = useState<BillingRate[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [monthlyBills, setMonthlyBills] = useState<Bill[]>([])
  const [showMonthDetailsModal, setShowMonthDetailsModal] = useState(false)
  const [formData, setFormData] = useState({
    tenant_id: '',
    room_id: '',
    amount: '',
    due_date: '',
    status: 'pending' as 'pending' | 'paid' | 'overdue' | 'partial',
    description: '',
  })

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    method: '' as 'gcash' | 'bank' | 'in_person',
    referenceNumber: '',
    receivedBy: '',
    amountPaid: 0,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [billsData, tenantsData, roomsData, billItemsData, paymentsData, electricReadingsData, billingRatesData] = await Promise.all([
      supabase.from('bills').select('*'),
      supabase.from('tenants').select('*'),
      supabase.from('rooms').select('*'),
      supabase.from('bill_items').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('electric_readings').select('*'),
      supabase.from('billing_rates').select('*'),
    ])

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
    if (tenantsData.data) setTenants(tenantsData.data)
    if (roomsData.data) setRooms(roomsData.data)
    if (paymentsData.data) setPayments(paymentsData.data)
    if (electricReadingsData.data) setElectricReadings(electricReadingsData.data)
    if (billingRatesData.data) setBillingRates(billingRatesData.data)
    setLoading(false)
  }

  // Create all 12 months for current year
  const currentYear = new Date().getFullYear()
  const monthlySummaries = Array.from({ length: 12 }, (_, index) => {
    const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`
    return calculateMonthlyAdminSummary(bills, payments, monthKey)
  })

  // Calculate overall billing summary
  const billingSummary = calculateAdminBillingSummary(bills, payments)
  const accurateBillingSummary = calculateAccurateBillingSummary(bills, payments)

  const handleViewMonthDetails = (monthKey: string) => {
    setSelectedMonth(monthKey)
    const monthBills = bills.filter(bill => {
      const billDate = new Date(bill.due_date)
      const billMonthKey = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`
      return billMonthKey === monthKey
    })
    setMonthlyBills(monthBills)
    setShowMonthDetailsModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { tenant_id, room_id, amount, due_date, status, description } = formData

    if (editingBill) {
      // Optimistic update - update bill immediately in UI
      const updatedBill: Bill = {
        ...editingBill,
        tenant_id,
        room_id,
        amount: parseFloat(amount),
        due_date,
        status: status as 'pending' | 'paid' | 'overdue' | 'partial',
        description,
        updated_at: new Date().toISOString(),
      }
      setBills(prevBills => prevBills.map(bill => bill.id === editingBill.id ? updatedBill : bill))

      const { error } = await supabase
        .from('bills')
        .update({
          tenant_id,
          room_id,
          amount: parseFloat(amount),
          due_date,
          status,
          description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingBill.id)
      if (error) {
        console.error('Error updating bill:', error)
        // Revert optimistic update if there's an error
        fetchData()
        alert('Failed to update bill. Please try again.')
        return
      }
    } else {
      // Create a temporary bill for optimistic update
      const newBill: Bill = {
        id: `temp-${Date.now()}`,
        tenant_id,
        room_id,
        amount: parseFloat(amount),
        due_date,
        status: status as 'pending' | 'paid' | 'overdue' | 'partial',
        description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [],
        totalPaid: 0,
        remaining: parseFloat(amount),
      }
      setBills(prevBills => [...prevBills, newBill])

      const { error, data } = await supabase.from('bills').insert({
        tenant_id,
        room_id,
        amount: parseFloat(amount),
        due_date,
        status,
        description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select()
      if (error) {
        console.error('Error creating bill:', error)
        // Revert optimistic update if there's an error
        setBills(prevBills => prevBills.filter(bill => bill.id !== newBill.id))
        alert('Failed to create bill. Please try again.')
        return
      }
    }

    setShowModal(false)
    setEditingBill(null)
    setFormData({
      tenant_id: '',
      room_id: '',
      amount: '',
      due_date: '',
      status: 'pending',
      description: '',
    })
    fetchData()
  }

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill)
    setFormData({
      tenant_id: bill.tenant_id,
      room_id: bill.room_id,
      amount: bill.amount.toString(),
      due_date: bill.due_date,
      status: bill.status,
      description: bill.description || '',
    })
    setShowModal(true)
  }

  const handlePay = (bill: Bill) => {
    setSelectedBill(bill)
    setPaymentForm({
      method: 'gcash',
      referenceNumber: '',
      receivedBy: '',
      amountPaid: bill.remaining || bill.amount,
    })
    setShowPaymentModal(true)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBill) return

    try {
      // Create payment record
      const paymentData: any = {
        bill_id: selectedBill.id,
        tenant_id: selectedBill.tenant_id,
        amount_paid: paymentForm.amountPaid || selectedBill.amount,
        payment_date: new Date().toISOString().split('T')[0],
        method: paymentForm.method,
        reference_number: paymentForm.referenceNumber,
        status: 'accepted', // Admin payments are accepted immediately
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
      await fetchData()
      setShowPaymentModal(false)
      setSelectedBill(null)
      setPaymentForm({
        method: 'gcash',
        referenceNumber: '',
        receivedBy: '',
        amountPaid: 0,
      })

      alert('Payment processed successfully!')
    } catch (error) {
      console.error('Payment error:', error)
      alert('Failed to process payment. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return
    
    // Optimistic update - remove bill immediately from UI
    const billToDelete = bills.find(bill => bill.id === id)
    if (billToDelete) {
      setBills(prevBills => prevBills.filter(bill => bill.id !== id))
      // Also update monthlyBills if it contains the bill being deleted
      setMonthlyBills(prevMonthlyBills => prevMonthlyBills.filter(bill => bill.id !== id))
    }
    
    const { error } = await supabase.from('bills').delete().eq('id', id)
    if (error) {
      console.error('Error deleting bill:', error)
      // Revert optimistic update if there's an error
      if (billToDelete) {
        setBills(prevBills => [...prevBills, billToDelete])
        setMonthlyBills(prevMonthlyBills => [...prevMonthlyBills, billToDelete])
      }
      alert('Failed to delete bill. Please try again.')
    }
  }

  const filteredBills = bills.filter(bill =>
    tenants.find(t => t.id === bill.tenant_id)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rooms.find(r => r.id === bill.room_id)?.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bill.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.amount.toString().includes(searchTerm)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Overall Billing Summary Cards */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Overall Billing Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Bills</dt>
                  <dd className="text-lg font-medium text-gray-900">{billingSummary.totalBills}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Amount</dt>
                  <dd className="text-lg font-medium text-gray-900">₱{accurateBillingSummary.totalAmount.toFixed(2)}</dd>
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
                  <dd className="text-lg font-medium text-gray-900">₱{accurateBillingSummary.totalPaid.toFixed(2)}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${accurateBillingSummary.remainingBalance > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} rounded-full flex items-center justify-center`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Remaining Balance</dt>
                  <dd className={`text-lg font-medium ${accurateBillingSummary.remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>₱{accurateBillingSummary.remainingBalance.toFixed(2)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Monthly Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
           {monthlySummaries.map((summary) => (
            <div
              key={summary.monthKey}
              onClick={() => handleViewMonthDetails(summary.monthKey)}
              className="group relative transform-style-preserve-3d transition-all duration-500 hover:translate-y-[-4px] hover:rotateX-2 hover:rotateY-2 cursor-pointer"
            >
              {/* 3D Card Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-500 rounded-md transform translate-z-[-1px] blur-sm opacity-50 group-hover:opacity-70 transition-all duration-300 group-hover:blur-md"></div>
              <div className="bg-white rounded-md shadow-md p-2 transform translate-z-0 relative transition-all duration-300 group-hover:shadow-lg group-hover:border-t-2 group-hover:border-blue-500">
                {/* Month Name */}
                <h3 className="text-sm font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {summary.monthName.split(' ')[0]} {/* Show only month name, not year */}
                </h3>

                {/* Total Revenue */}
                <div className="mb-1">
                  <p className="text-gray-500 text-xs mb-0.5">Revenue</p>
                  <p className="text-sm font-semibold text-gray-900">₱{summary.revenue.toFixed(2)}</p>
                </div>

                {/* Total Bills */}
                <div className="mb-1">
                  <p className="text-gray-500 text-xs mb-0.5">Bills</p>
                  <p className="text-sm font-semibold text-gray-900">{summary.totalBills}</p>
                </div>

                {/* Status Summary */}
                <div className="space-y-0.5 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Paid:</span>
                    <span className="text-xs font-semibold text-green-600">{summary.statusCounts.paid}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Partial:</span>
                    <span className="text-xs font-semibold text-yellow-600">{summary.statusCounts.partial}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Pending:</span>
                    <span className="text-xs font-semibold text-gray-600">{summary.statusCounts.pending}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Overdue:</span>
                    <span className="text-xs font-semibold text-red-600">{summary.statusCounts.overdue}</span>
                  </div>
                </div>


              </div>
            </div>
          ))}
        </div>
      </div>

       {/* Month Details Modal */}
      {showMonthDetailsModal && selectedMonth && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Bills for {Object.values(monthlySummaries).find(s => s.monthKey === selectedMonth)?.monthName}
              </h3>
              <button
                onClick={() => setShowMonthDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Bills per Room Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...monthlyBills]
                .sort((a, b) => {
                  const roomA = rooms.find(r => r.id === a.room_id)?.room_number || ''
                  const roomB = rooms.find(r => r.id === b.room_id)?.room_number || ''
                  return roomA.localeCompare(roomB, undefined, { numeric: true })
                })
                .map((bill) => {
                const tenant = tenants.find(t => t.id === bill.tenant_id)
                const room = rooms.find(r => r.id === bill.room_id)
                
                return (
                  <div
                    key={bill.id}
                    className="group relative transform-style-preserve-3d transition-all duration-500 hover:translate-y-[-6px] hover:rotateX-2 hover:rotateY-2"
                  >
                    {/* 3D Card Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg transform translate-z-[-1px] blur-md opacity-50 group-hover:opacity-70 transition-all duration-300 group-hover:blur-lg"></div>
                    <div className="bg-white rounded-lg shadow-lg p-4 transform translate-z-0 relative transition-all duration-300 group-hover:shadow-2xl group-hover:border-t-4 group-hover:border-blue-500">
                      {/* Status Badge */}
                      <div className="absolute top-4 right-4">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
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
                      </div>

                      {/* Room Number */}
                      <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {room?.room_number || 'N/A'}
                      </h3>

                      {/* Tenant Name */}
                      <p className="text-gray-600 mb-1 text-sm font-medium">{tenant?.name || 'N/A'}</p>

                      {/* Total Bill Amount */}
                      <div className="mb-4">
                        <p className="text-gray-500 text-sm mb-1">Total Bill</p>
                        <p className="text-lg font-semibold text-gray-900">₱{bill.amount.toFixed(2)}</p>
                      </div>

                      {/* Payment Details */}
                      <div className="space-y-2 mb-4">
                        <div>
                          <p className="text-gray-500 text-sm mb-1">Total Paid</p>
                          <p className="font-semibold text-green-600">₱{(bill.totalPaid || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm mb-1">Remaining Balance</p>
                          <p className={`font-semibold ${(bill.remaining || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₱{(bill.remaining || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Due Date */}
                      <div className="mb-4">
                        <p className="text-gray-500 text-sm mb-1">Due Date</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(bill.due_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>

                      {/* Bill Items */}
                      {bill.items && bill.items.length > 0 && (
                        <div className="mb-4">
                          <p className="text-gray-500 text-sm mb-2 font-medium">Bill Items</p>
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            {bill.items.map((item, index) => (
                              <div key={index} className="text-sm">
                                <div className="flex justify-between">
                                  <span className="font-medium">{item.item_type.replace('_', ' ').toUpperCase()}:</span>
                                  <span>₱{item.amount.toFixed(2)}</span>
                                </div>
                                {item.details && (
                                  <div className="text-xs text-gray-600 mt-1">{item.details}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleEdit(bill)}
                          className="flex-2 px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handlePay(bill)}
                          className="flex-1 px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Pay Bill
                        </button>
                        <button
                          onClick={() => handleDelete(bill.id)}
                          className="px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* No Bills Message */}
            {monthlyBills.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No bills for this month</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-md mx-4 my-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Pay Bill - Room {rooms.find(r => r.id === selectedBill.room_id)?.room_number}
              </h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setSelectedBill(null)
                  setPaymentForm({
                    method: 'gcash',
                    referenceNumber: '',
                    receivedBy: '',
                    amountPaid: 0,
                  })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Bill Amount</span>
                  <span className="text-lg font-bold text-gray-900">₱{selectedBill.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm font-medium text-gray-700">Amount Paid</span>
                  <span className="text-lg font-bold text-green-600">₱{(selectedBill.totalPaid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-medium text-gray-700">Remaining Balance</span>
                    <span className="text-lg font-bold text-red-600">₱{(selectedBill.remaining || selectedBill.amount).toFixed(2)}</span>
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Pay</label>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="Enter amount"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <div className="space-y-2">
                  {[
                    { value: 'gcash', label: 'GCash' },
                    { value: 'bank', label: 'Bank Transfer' },
                    { value: 'in_person', label: 'In Person' },
                  ].map((method) => (
                    <label key={method.value} className="flex items-center">
                      <input
                        type="radio"
                        name="method"
                        value={method.value}
                        checked={paymentForm.method === method.value}
                        onChange={() => setPaymentForm(prev => ({ ...prev, method: method.value as any }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        required
                      />
                      <span className="ml-3 text-sm text-gray-700">{method.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {paymentForm.method === 'gcash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="Enter GCash reference number"
                  />
                </div>
              )}

              {paymentForm.method === 'bank' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="Enter bank reference number"
                  />
                </div>
              )}

              {paymentForm.method === 'in_person' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                  <input
                    type="text"
                    value={paymentForm.receivedBy}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, receivedBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="Enter receiver's name"
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
                      method: 'gcash',
                      referenceNumber: '',
                      receivedBy: '',
                      amountPaid: 0,
                    })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Pay Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Bill Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-md mx-4 my-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {editingBill ? 'Edit Bill' : 'Add Bill'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Tenant</label>
                <select
                  value={formData.tenant_id}
                  onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select a tenant</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Room</label>
                <select
                  value={formData.room_id}
                  onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select a room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="input-field"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                ></textarea>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingBill(null)
                    setFormData({
                      tenant_id: '',
                      room_id: '',
                      amount: '',
                      due_date: '',
                      status: 'pending',
                      description: '',
                    })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors">
                  {editingBill ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
