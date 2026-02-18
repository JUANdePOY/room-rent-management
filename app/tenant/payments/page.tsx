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
        <h2 className="text-2xl font-bold text-gray-900">My Payments</h2>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          Add Payment
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill Remaining
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received By
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
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {bill?.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ₱{bill?.amount.toFixed(2) || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ₱{payment.amount_paid.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${
                        remaining > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        ₱{remaining.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMethodLabel(payment.method)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.reference_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.received_by}
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ₱{
                          payment.status === 'accepted'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'declined'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.receipt_image && (
                        <a
                          href={payment.receipt_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Receipt
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {payments.length === 0 && (
          <p className="text-center text-gray-500 py-8">No payments found</p>
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
                    placeholder={formData.bill_id ? `Enter amount (current remaining: ₱₱{getBillRemainingBalance(formData.bill_id).toFixed(2)})` : 'Enter amount'}
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
                </div>
                {errors.method && (
                  <p className="text-sm text-red-600">{errors.method}</p>
                )}
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
                    required
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
                    placeholder="Enter name of person who received payment"
                    required
                  />
                  {errors.received_by && (
                    <p className="text-sm text-red-600">{errors.received_by}</p>
                  )}
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setFormData({
                      bill_id: '',
                      amount_paid: '',
                      payment_date: new Date().toISOString().split('T')[0],
                      method: 'gcash',
                      reference_number: '',
                      received_by: '',
                    })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
