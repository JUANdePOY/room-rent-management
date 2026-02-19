'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Payment, Tenant, Bill, BillItem } from '../../../types'

export default function TenantPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    bill_id: '',
    amount_paid: '',
    payment_date: new Date().toISOString().split('T')[0],
    method: '' as 'gcash' | 'bank' | 'in_person',
    reference_number: '',
    received_by: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

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

      const [billsData, paymentsData, billItemsData] = await Promise.all([
        supabase.from('bills').select('*').eq('tenant_id', tenantData.id),
        supabase.from('payments').select('*').eq('tenant_id', tenantData.id),
        supabase.from('bill_items').select('*'),
      ])

      if (billsData.data) setBills(billsData.data)
      if (paymentsData.data) setPayments(paymentsData.data)
      if (billItemsData.data) setBillItems(billItemsData.data)
    }

    setLoading(false)
  }

  const handleMethodChange = (method: 'gcash' | 'bank' | 'in_person') => {
    setFormData(prev => ({
      ...prev,
      method,
      reference_number: '',
      received_by: '',
    }))
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'gcash': return 'GCash'
      case 'bank': return 'Bank Transfer'
      case 'in_person': return 'In Person'
      default: return method
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full bg-green-100 text-green-800">
            ✔ Accepted
          </span>
        )
      case 'declined':
        return (
          <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full bg-red-100 text-red-800">
            ✗ Declined
          </span>
        )
      default:
        return (
          <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
            ⏳ Pending
          </span>
        )
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.amount_paid || parseFloat(formData.amount_paid) <= 0) {
      newErrors.amount_paid = 'Please enter a valid amount greater than 0'
    }
    
    if (!formData.payment_date) {
      newErrors.payment_date = 'Please select a payment date'
    }
    
    if (!formData.method) {
      newErrors.method = 'Please select a payment method'
    }
    
    if (formData.method && formData.method !== 'in_person' && !formData.reference_number) {
      newErrors.reference_number = 'Please enter a reference number'
    }
    
    if (formData.method === 'in_person' && !formData.received_by) {
      newErrors.received_by = 'Please enter who received the payment'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getBillRemainingBalance = (billId: string): number => {
    const bill = bills.find(b => b.id === billId)
    if (!bill) return 0
    
    const billItemsForBill = billItems.filter(item => item.bill_id === billId)
    const billPayments = payments.filter(payment => 
      payment.bill_id === billId && payment.status === 'accepted'
    )
    
    const totalBill = billItemsForBill.length > 0 
      ? billItemsForBill.reduce((sum, item) => sum + item.amount, 0) 
      : bill.amount
    
    const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
    
    return totalBill - totalPaid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    const { bill_id, amount_paid, payment_date, method, reference_number, received_by } = formData

    try {
      const { error } = await supabase.from('payments').insert({
        bill_id,
        tenant_id: tenant?.id,
        amount_paid: parseFloat(amount_paid),
        payment_date,
        method,
        reference_number,
        received_by,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      
      if (error) {
        console.error('Error creating payment:', error)
        alert('Failed to create payment: ' + error.message)
        return
      }

      // Update bill status if bill is specified and payment is pending (will be accepted by admin)
      if (bill_id) {
        const { data: billPayments } = await supabase
          .from('payments')
          .select('amount_paid')
          .eq('bill_id', bill_id)
          .eq('status', 'accepted')

        const totalPaid = billPayments?.reduce((sum, payment) => sum + payment.amount_paid, 0) || 0
        const bill = bills.find(b => b.id === bill_id)
        
        if (bill) {
          const { data: billItems } = await supabase
            .from('bill_items')
            .select('*')
            .eq('bill_id', bill.id)
            
          const totalBill = billItems && billItems.length > 0 
            ? billItems.reduce((sum, item) => sum + item.amount, 0) 
            : bill.amount

          let newStatus: 'pending' | 'paid' | 'overdue' | 'partial' = bill.status
          
          if (totalPaid >= totalBill) {
            newStatus = 'paid'
          } else if (totalPaid > 0) {
            newStatus = 'partial'
          } else if (new Date() > new Date(bill.due_date)) {
            newStatus = 'overdue'
          }

          await supabase
            .from('bills')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', bill_id)
        }
      }

      setShowModal(false)
      setFormData({
        bill_id: '',
        amount_paid: '',
        payment_date: new Date().toISOString().split('T')[0],
        method: 'gcash',
        reference_number: '',
        received_by: '',
      })
      fetchData()
    } catch (error) {
      console.error('Error handling payment submission:', error)
      alert('An unexpected error occurred: ' + (error as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Payments</h2>
          <p className="text-gray-600 mt-1">Track and manage all your payment transactions</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Payment</span>
        </button>
      </div>

      {/* Payment Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Accepted</p>
              <p className="text-2xl font-bold text-green-600">
                {payments.filter(p => p.status === 'accepted').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {payments.filter(p => p.status === 'pending').length}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill Information
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => {
                const bill = bills.find(b => b.id === payment.bill_id)
                
                // Calculate remaining balance after this payment
                const billPayments = payments.filter(p => 
                  p.bill_id === payment.bill_id && p.status === 'accepted' && p.id <= payment.id
                )
                const totalPaidUpToThisPayment = billPayments.reduce((sum, p) => sum + p.amount_paid, 0)
                const remaining = bill ? bill.amount - totalPaidUpToThisPayment : 0

                return (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-mono text-sm text-gray-900">
                            #{payment.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 flex items-center space-x-2">
                          <span>₱{payment.amount_paid.toFixed(2)}</span>
                          <span className="text-gray-400">•</span>
                          <span>{getMethodLabel(payment.method)}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </div>
                        {payment.reference_number && (
                          <div className="text-xs text-gray-500 mt-1 bg-gray-100 px-2 py-1 rounded inline-block">
                            Ref: {payment.reference_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {bill ? (
                        <div className="flex flex-col">
                          <div className="font-medium text-gray-900">
                            Bill #{bill.id.slice(0, 8)}
                          </div>
                          <div className="text-sm text-gray-600">
                            Total: ₱{bill.amount.toFixed(2)}
                          </div>
                          <div className={`text-sm ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Remaining: ₱{remaining.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Due: {new Date(bill.due_date).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No bill associated</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.receipt_image ? (
                        <a
                          href={payment.receipt_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-900 text-sm font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span>View Receipt</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">No receipt</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {payments.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg text-gray-600 mb-2">No payments yet</p>
            <p className="text-gray-500 mb-6">Get started by adding your first payment</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Payment
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-lg mx-4 my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Add Payment
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Bill (Optional)</label>
                <select
                  value={formData.bill_id}
                  onChange={(e) => setFormData({ ...formData, bill_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select Bill (Optional)</option>
                  {bills.map((bill) => {
                    const remaining = getBillRemainingBalance(bill.id)
                    return (
                      <option key={bill.id} value={bill.id}>
                        Bill #{bill.id.slice(0, 8)} - ₱{bill.amount.toFixed(2)} (Remaining: ₱{remaining.toFixed(2)}) - Due: {new Date(bill.due_date).toLocaleDateString()}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Detailed Bill Items Breakdown */}
              {formData.bill_id && (
                <div>
                  <label className="label">Bill Breakdown</label>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {(() => {
                      const selectedBill = bills.find(b => b.id === formData.bill_id)
                      if (!selectedBill) return null

                      const items = billItems.filter(item => item.bill_id === formData.bill_id)
                      if (items.length === 0) {
                        return <div className="text-sm text-gray-500">No detailed items available for this bill</div>
                      }

                      const billPayments = payments.filter(payment => 
                        payment.bill_id === formData.bill_id && payment.status === 'accepted'
                      )
                      const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)

                      return (
                        <>
                          {items.map((item, index) => {
                            const paymentAllocation = item.amount / selectedBill.amount
                            const itemPaid = totalPaid * paymentAllocation
                            const itemRemaining = item.amount - itemPaid
                            const paymentAmountForItem = parseFloat(formData.amount_paid || '0') * paymentAllocation
                            const itemRemainingAfterPayment = itemRemaining - paymentAmountForItem

                            return (
                              <div key={index} className="text-sm">
                                <div className="flex justify-between">
                                  <span className="font-medium">{item.item_type}:</span>
                                  <span>₱{item.amount.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  Paid: ₱{itemPaid.toFixed(2)} | Remaining: <span className={itemRemaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{itemRemaining.toFixed(2)}</span>
                                  {parseFloat(formData.amount_paid || '0') > 0 && (
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
                              {(() => {
                                const remaining = getBillRemainingBalance(formData.bill_id)
                                const afterPayment = remaining - parseFloat(formData.amount_paid || '0')
                                return (
                                  <>
                                    Paid: ₱{totalPaid.toFixed(2)} | Remaining: <span className={remaining > 0 ? 'text-red-600' : 'text-green-600'}>₱{remaining.toFixed(2)}</span>
                                    {parseFloat(formData.amount_paid || '0') > 0 && (
                                      <span className="ml-2">
                                        After Payment: <span className={afterPayment > 0 ? 'text-red-600' : 'text-green-600'}>₱{afterPayment.toFixed(2)}</span>
                                      </span>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
              
              <div>
                <label className="label">Amount Paid</label>
                <div className="space-y-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount_paid}
                    onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                    className={`input-field ${errors.amount_paid ? 'border-red-500' : ''}`}
                    placeholder={formData.bill_id ? `Enter amount (current remaining: ₱${getBillRemainingBalance(formData.bill_id).toFixed(2)})` : 'Enter amount'}
                  />
                  {errors.amount_paid && (
                    <p className="text-sm text-red-600">{errors.amount_paid}</p>
                  )}
                  {formData.bill_id && (
                    <div className="text-sm text-gray-600">
                      Bill Balance: ₱{getBillRemainingBalance(formData.bill_id).toFixed(2)}
                      {parseFloat(formData.amount_paid) > 0 && (
                        <span className="ml-2">
                          After Payment: ₱{(getBillRemainingBalance(formData.bill_id) - parseFloat(formData.amount_paid)).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="label">Payment Date</label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className={`input-field ${errors.payment_date ? 'border-red-500' : ''}`}
                />
                {errors.payment_date && (
                  <p className="text-sm text-red-600">{errors.payment_date}</p>
                )}
              </div>
              
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
                        checked={formData.method === method.value}
                        onChange={() => handleMethodChange(method.value as 'gcash' | 'bank' | 'in_person')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <label htmlFor={method.value} className="ml-2 block text-sm text-gray-700">
                        {method.label}
                      </label>
                    </div>
                  ))}
                  {errors.method && (
                    <p className="text-sm text-red-600">{errors.method}</p>
                  )}
                </div>
              </div>
              
              {formData.method && formData.method !== 'in_person' && (
                <div>
                  <label className="label">Reference Number</label>
                  <input
                    type="text"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    className={`input-field ${errors.reference_number ? 'border-red-500' : ''}`}
                    placeholder="Enter reference number"
                  />
                  {errors.reference_number && (
                    <p className="text-sm text-red-600">{errors.reference_number}</p>
                  )}
                </div>
              )}
              
              {formData.method === 'in_person' && (
                <div>
                  <label className="label">Received By</label>
                  <input
                    type="text"
                    value={formData.received_by}
                    onChange={(e) => setFormData({ ...formData, received_by: e.target.value })}
                    className={`input-field ${errors.received_by ? 'border-red-500' : ''}`}
                    placeholder="Enter who received the payment"
                  />
                  {errors.received_by && (
                    <p className="text-sm text-red-600">{errors.received_by}</p>
                  )}
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
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
