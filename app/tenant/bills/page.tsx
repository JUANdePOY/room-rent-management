'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Bill, Tenant, Room, BillItem, Payment, ElectricReading, BillingRate } from '../../../types'
import { calculateTotalBill, calculateRemainingBill, calculateTotalPaid } from '../../../lib/billingUtils'

export default function TenantBillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [electricReadings, setElectricReadings] = useState<ElectricReading[]>([])
  const [billingRates, setBillingRates] = useState<BillingRate[]>([])
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

      const [roomData, billsData, billItemsData, paymentsData, electricReadingsData, billingRatesData] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', tenantData.room_id).single(),
        supabase.from('bills').select('*').eq('tenant_id', tenantData.id),
        supabase.from('bill_items').select('*'),
        supabase.from('payments').select('*').eq('tenant_id', tenantData.id),
        supabase.from('electric_readings').select('*').eq('room_id', tenantData.room_id),
        supabase.from('billing_rates').select('*'),
      ])

      console.log('Rooms data:', roomData)
      console.log('Bills data:', billsData)
      console.log('Bill items data:', billItemsData)
      console.log('Payments data:', paymentsData)

      if (roomData.data) setRoom(roomData.data)
      if (paymentsData.data) setPayments(paymentsData.data)
      if (electricReadingsData.data) setElectricReadings(electricReadingsData.data)
      if (billingRatesData.data) setBillingRates(billingRatesData.data)
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

      {/* Current Month Bills - Prominent Display */}
      {currentMonthBills.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Current Month - {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          {currentMonthBills.map((bill) => (
            <div key={bill.id} className="bg-white rounded-xl shadow-lg overflow-hidden border-l-4 border-blue-500">
              {/* Bill Header */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <div className="mb-4 md:mb-0">
                    <div className="flex items-center mb-2">
                      <span className="text-lg font-semibold text-gray-900">Room {room?.room_number}</span>
                      <span className={`ml-3 px-3 py-1 text-sm font-semibold rounded-full ${
                        bill.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : bill.status === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : bill.status === 'partial'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Due Date: {new Date(bill.due_date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                   <div className="text-center md:text-right w-full md:w-auto">
                    <p className="text-sm text-gray-600">Total Bill</p>
                    <p className="text-3xl font-bold text-gray-900">₱{bill.amount.toFixed(2)}</p>
                    <p className="text-sm text-gray-600 mt-2">Remaining Bill</p>
                     <p className={`text-2xl font-bold ${calculateRemainingBill(bill, payments) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₱{calculateRemainingBill(bill, payments).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bill Details */}
              <div className="p-6">
                {/* Payment Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                    <span>Payment Progress</span>
                    <span>
                      {Math.round((calculateTotalPaid(bill, payments) / bill.amount) * 100)}% Paid
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        bill.status === 'paid' ? 'bg-green-500' :
                        bill.status === 'overdue' ? 'bg-red-500' :
                        bill.status === 'partial' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min((calculateTotalPaid(bill, payments) / bill.amount) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    Paid: ₱{calculateTotalPaid(bill, payments).toFixed(2)}
                  </div>
                </div>

                {/* Bill Items */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Bill Breakdown</h4>
                  <div className="space-y-3">
                    {bill.items && bill.items.length > 0 ? (
                      bill.items.map((item, index) => {
                        const paymentAllocation = item.amount / bill.amount
                        const itemPaid = (bill as any).totalPaid * paymentAllocation
                        const itemRemaining = item.amount - itemPaid
                        
                          // Enhanced electricity bill item with actual data
                        if (item.item_type === 'electricity') {
                          // Calculate actual consumption based on electric readings and billing rates
                          const billDate = new Date(bill.due_date)
                          const billMonth = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`
                          const nextMonthDate = new Date(billDate.getFullYear(), billDate.getMonth(), 1)
                          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1)
                          const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
                          
                          // Get current and next month's readings
                          const currentReading = electricReadings.find(r => 
                            r.room_id === room?.id && r.month_year === billMonth
                          )
                          const nextReading = electricReadings.find(r => 
                            r.room_id === room?.id && r.month_year === nextMonth
                          )
                          
                          // Get billing rate for current month
                          const billingRate = billingRates.find(r => 
                            r.month_year === billMonth
                          )
                          
                          let usage = 0
                          let rate = 0
                          let currentReadingVal = 0
                          let nextReadingVal = 0
                          
                          if (currentReading && nextReading) {
                            currentReadingVal = currentReading.reading
                            nextReadingVal = nextReading.reading
                            usage = nextReadingVal - currentReadingVal
                          }
                          
                          if (billingRate) {
                            rate = billingRate.electricity_rate
                          }
                          
                          return (
                            <div key={index} className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {item.item_type.replace('_', ' ').toUpperCase()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-900">₱{item.amount.toFixed(2)}</p>
                                </div>
                              </div>
                              
                              {item.details && (
                                <div className="space-y-1 mb-2">
                                  <p></p>
                                </div>
                              )}
                              
                              {usage > 0 && rate > 0 && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-white p-2 rounded">
                                    <span className="text-gray-500 block">Current Reading</span>
                                    <span className="font-medium">{currentReadingVal.toFixed(2)} kWh</span>
                                  </div>
                                  <div className="bg-white p-2 rounded">
                                    <span className="text-gray-500 block">Next Reading</span>
                                    <span className="font-medium">{nextReadingVal.toFixed(2)} kWh</span>
                                  </div>
                                  <div className="bg-white p-2 rounded">
                                    <span className="text-gray-500 block">Consumption</span>
                                    <span className="font-medium">{usage.toFixed(2)} kWh</span>
                                  </div>
                                  <div className="bg-white p-2 rounded">
                                    <span className="text-gray-500 block">Rate per kWh</span>
                                    <span className="font-medium">₱{rate.toFixed(4)}</span>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-between text-xs text-gray-500 mt-2">
                                <span>Paid: ₱{itemPaid.toFixed(2)}</span>
                                <span>Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span></span>
                              </div>
                            </div>
                          )
                        }
                        
                        // Enhanced water bill item
                        if (item.item_type === 'water') {
                          return (
                            <div key={index} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {item.item_type.replace('_', ' ').toUpperCase()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-900">₱{item.amount.toFixed(2)}</p>
                                </div>
                              </div>
                              
                              {item.details && (
                                <div className="space-y-1 mb-2">
                                  <p className="text-xs text-gray-600">{item.details}</p>
                                </div>
                              )}
                              
                              <div className="flex justify-between text-xs text-gray-500 mt-2">
                                <span>Paid: ₱{itemPaid.toFixed(2)}</span>
                                <span>Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span></span>
                              </div>
                            </div>
                          )
                        }
                        
                        // Enhanced WiFi bill item
                        if (item.item_type === 'wifi') {
                          return (
                            <div key={index} className="p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {item.item_type.replace('_', ' ').toUpperCase()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-900">₱{item.amount.toFixed(2)}</p>
                                </div>
                              </div>
                              
                              {item.details && (
                                <div className="space-y-1 mb-2">
                                  <p className="text-xs text-gray-600">{item.details}</p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white p-2 rounded">
                                  <span className="text-gray-500 block">Plan</span>
                                  <span className="font-medium">10 Mbps</span>
                                </div>
                                <div className="bg-white p-2 rounded">
                                  <span className="text-gray-500 block">Usage</span>
                                  <span className="font-medium">Unlimited</span>
                                </div>
                              </div>
                              
                              <div className="flex justify-between text-xs text-gray-500 mt-2">
                                <span>Paid: ₱{itemPaid.toFixed(2)}</span>
                                <span>Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span></span>
                              </div>
                            </div>
                          )
                        }
                        
                        // Enhanced room rent bill item
                        if (item.item_type === 'room_rent') {
                          return (
                            <div key={index} className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {item.item_type.replace('_', ' ').toUpperCase()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-900">₱{item.amount.toFixed(2)}</p>
                                </div>
                              </div>
                              
                              {item.details && (
                                <div className="space-y-1 mb-2">
                                  <p className="text-xs text-gray-600">{item.details}</p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white p-2 rounded">
                                  <span className="text-gray-500 block">Room Type</span>
                                  <span className="font-medium">{room?.type || 'Standard'}</span>
                                </div>
                                <div className="bg-white p-2 rounded">
                                  <span className="text-gray-500 block">Room Number</span>
                                  <span className="font-medium">{room?.room_number || 'N/A'}</span>
                                </div>
                              </div>
                              
                              <div className="flex justify-between text-xs text-gray-500 mt-2">
                                <span>Paid: ₱{itemPaid.toFixed(2)}</span>
                                <span>Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span></span>
                              </div>
                            </div>
                          )
                        }
                        
                        // Default bill item format for other types
                        return (
                          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {item.item_type.replace('_', ' ').toUpperCase()}
                              </p>
                              {item.details && (
                                <p className="text-xs text-gray-500 mt-1">{item.details}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">₱{item.amount.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">
                                Paid: ₱{itemPaid.toFixed(2)} | Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span>
                              </p>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-center text-gray-500 py-4">No bill items available</p>
                    )}
                  </div>
                </div>

                {/* Description */}
                {bill.description && (
                  <div className="mb-6 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700">{bill.description}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
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
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Pay Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past Months Bills - Compact Cards */}
      {pastMonthsBills.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Past Months Bills</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastMonthsBills.map((bill) => (
              <div key={bill.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Bill Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {new Date(bill.due_date).toLocaleDateString('en-US', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                      <p className="text-sm text-gray-500">Room {room?.room_number}</p>
                    </div>
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
                </div>

                {/* Bill Details */}
                <div className="p-4">
                  {/* Amount Summary */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                      <span>Total Bill</span>
                      <span>₱{bill.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Paid</span>
                      <span>₱{(bill as any).totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Remaining</span>
                      <span className={calculateRemainingBill(bill, payments) > 0 ? 'text-red-600' : 'text-green-600'}>
                        ₱{calculateRemainingBill(bill, payments).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Progress */}
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          bill.status === 'paid' ? 'bg-green-500' :
                          bill.status === 'overdue' ? 'bg-red-500' :
                          bill.status === 'partial' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(((bill as any).totalPaid / bill.amount) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Bill Items Count */}
                  {bill.items && bill.items.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500">
                        {bill.items.length} bill item{bill.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {bill.remaining !== undefined && bill.remaining > 0 && (
                      <button
                        onClick={() => {
                          setSelectedBill(bill)
                          setPaymentForm(prev => ({
                            ...prev,
                            amountPaid: calculateRemainingBill(bill, payments)
                          }))
                          setShowPaymentModal(true)
                        }}
                        className="px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Pay Now
                      </button>
                    )}
                    <button
                      onClick={() => {
                        // Could add print functionality here
                        window.print()
                      }}
                      className="px-3 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50">
          <div className="bg-white rounded-t-xl sm:rounded-xl p-6 w-full max-w-md sm:max-w-lg mx-4 my-4 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Pay Bill - ₱{selectedBill.amount.toFixed(2)}
              </h3>
              <button
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
                  <span className="text-lg font-bold text-green-600">₱{(selectedBill as any).totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-medium text-gray-700">Remaining Balance</span>
                    <span className="text-lg font-bold text-red-600">₱{calculateRemainingBill(selectedBill, payments).toFixed(2)}</span>
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

              {/* Detailed Bill Items Breakdown */}
              {selectedBill.items && selectedBill.items.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bill Breakdown</label>
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
                            <span className="font-medium">{item.item_type.replace('_', ' ').toUpperCase()}:</span>
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
                          Paid: ₱{calculateTotalPaid(selectedBill, payments).toFixed(2)} | Remaining: <span className={calculateRemainingBill(selectedBill, payments) > 0 ? 'text-red-600' : 'text-green-600'}>₱{calculateRemainingBill(selectedBill, payments).toFixed(2)}</span>
                          {paymentForm.amountPaid > 0 && (
                            <span className="ml-2">
                              After Payment: <span className={calculateRemainingBill(selectedBill, payments) - paymentForm.amountPaid > 0 ? 'text-red-600' : 'text-green-600'}>₱{(calculateRemainingBill(selectedBill, payments) - paymentForm.amountPaid).toFixed(2)}</span>
                            </span>
                          )}
                        </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      referenceNumber: e.target.value,
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="Enter reference number"
                  />
                </div>
              )}

              {paymentForm.method === 'in_person' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                  <input
                    type="text"
                    value={paymentForm.receivedBy}
                    onChange={(e) => setPaymentForm(prev => ({
                      ...prev,
                      receivedBy: e.target.value,
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
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
