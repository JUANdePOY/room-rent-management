'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Payment, Bill, Tenant, BillItem } from '../../../types'


export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'accepted' | 'declined'>('pending')
  const [formData, setFormData] = useState({
    tenant_id: '',
    bill_id: '',
    amount_paid: '',
    payment_date: '',
    method: '' as 'gcash' | 'bank' | 'in_person',
    reference_number: '',
    received_by: '',
    status: 'accepted' as 'pending' | 'accepted' | 'declined',
  })

  // Calculate remaining balance for selected bill
  const getBillRemainingBalance = (billId: string): number => {
    const bill = bills.find(b => b.id === billId)
    if (!bill) return 0
    
    const billPayments = payments.filter(payment => 
      payment.bill_id === billId && payment.status === 'accepted'
    )
    const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
    return bill.amount - totalPaid
  }
  const [totalRemainingBill, setTotalRemainingBill] = useState<number>(0)

  useEffect(() => {
    fetchData()
  }, [])

  const calculateTotalRemainingBill = (tenantId: string) => {
    // Get current month
    const currentDate = new Date()
    const currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0')
    
    // Get current month's bill for the tenant
    const currentMonthBills = bills.filter(bill => {
      return bill.tenant_id === tenantId && bill.description?.includes(currentMonth)
    })
    
    if (currentMonthBills.length > 0) {
      const currentBill = currentMonthBills[0]
      
      // Calculate remaining balance for current month's bill
      const billPayments = payments.filter(payment => 
        payment.bill_id === currentBill.id && payment.status === 'accepted'
      )
      const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
      const remaining = currentBill.amount - totalPaid
      setTotalRemainingBill(Math.max(0, remaining))
      
      setFormData(prev => ({
        ...prev,
        bill_id: currentBill.id
      }))
    } else {
      // If no current month bill, check for pending bills from previous months
      const pendingBills = bills.filter(bill => {
        const billPayments = payments.filter(payment => payment.bill_id === bill.id && payment.status === 'accepted')
        const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
        return bill.tenant_id === tenantId && bill.amount > totalPaid
      })
      
      if (pendingBills.length > 0) {
      const latestPendingBill = pendingBills.sort((a, b) =>
          new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
        )[0]
        
        const billPayments = payments.filter(payment => 
          payment.bill_id === latestPendingBill.id && payment.status === 'accepted'
        )
        const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
        const remaining = latestPendingBill.amount - totalPaid
        setTotalRemainingBill(Math.max(0, remaining))
        
        setFormData(prev => ({
          ...prev,
          bill_id: latestPendingBill.id
        }))
      } else {
        setTotalRemainingBill(0)
        setFormData(prev => ({
          ...prev,
          bill_id: ''
        }))
      }
    }
  }

  const [billItems, setBillItems] = useState<BillItem[]>([])

  const fetchData = async () => {
    try {
      const [paymentsData, billsData, tenantsData, billItemsData] = await Promise.all([
        supabase.from('payments').select('*'),
        supabase.from('bills').select('*'),
        supabase.from('tenants').select('*'),
        supabase.from('bill_items').select('*'),
      ])

      if (paymentsData.error) {
        console.error('Error fetching payments:', paymentsData.error)
        alert('Failed to fetch payments: ' + paymentsData.error.message)
      } else if (paymentsData.data) {
        setPayments(paymentsData.data)
      }

      if (billsData.error) {
        console.error('Error fetching bills:', billsData.error)
        alert('Failed to fetch bills: ' + billsData.error.message)
      } else if (billsData.data) {
        setBills(billsData.data)
      }

      if (tenantsData.error) {
        console.error('Error fetching tenants:', tenantsData.error)
        alert('Failed to fetch tenants: ' + tenantsData.error.message)
      } else if (tenantsData.data) {
        setTenants(tenantsData.data)
      }

      if (billItemsData.error) {
        console.error('Error fetching bill items:', billItemsData.error)
        alert('Failed to fetch bill items: ' + billItemsData.error.message)
      } else if (billItemsData.data) {
        setBillItems(billItemsData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Failed to fetch data: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { bill_id, tenant_id, amount_paid, payment_date, method, reference_number, received_by, status } = formData

    try {
      if (editingPayment) {
        const { error } = await supabase
          .from('payments')
          .update({
            bill_id,
            tenant_id,
            amount_paid: parseFloat(amount_paid),
            payment_date,
            method,
            reference_number,
            received_by,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPayment.id)
          
        if (error) {
          console.error('Error updating payment:', error)
          alert('Failed to update payment: ' + error.message)
          return
        }
      } else {
        const { error } = await supabase.from('payments').insert({
          bill_id,
          tenant_id,
          amount_paid: parseFloat(amount_paid),
          payment_date,
          method,
          reference_number,
          received_by,
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        
        if (error) {
          console.error('Error creating payment:', error)
          alert('Failed to create payment: ' + error.message)
          return
        }
      }

      // Update bill status if bill is specified and payment is accepted
      if (bill_id && status === 'accepted') {
        const { data: billPayments } = await supabase
          .from('payments')
          .select('amount_paid')
          .eq('bill_id', bill_id)
          .eq('status', 'accepted')

        const totalPaid = billPayments?.reduce((sum, payment) => sum + payment.amount_paid, 0) || 0
        const bill = bills.find(b => b.id === bill_id)
        
        if (bill) {
          let newStatus: 'pending' | 'paid' | 'overdue' | 'partial' = bill.status
          
          if (totalPaid >= bill.amount) {
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

          // If previous month's bill is now paid in full, update current month's bill to remove remaining balance
          if (newStatus === 'paid') {
            const currentDate = new Date()
            const currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0')
            
            // Get current month's bill for the same tenant
            const { data: currentMonthBills } = await supabase
              .from('bills')
              .select('*')
              .eq('tenant_id', bill.tenant_id)
              .ilike('description', `%${currentMonth}%`)

            if (currentMonthBills && currentMonthBills.length > 0) {
              const currentBill = currentMonthBills[0]
              
              // Get bill items for current month's bill
              const { data: currentBillItems } = await supabase
                .from('bill_items')
                .select('*')
                .eq('bill_id', currentBill.id)

              // Check if current bill has remaining balance from previous month
              const remainingBalanceItem = currentBillItems?.find(item => item.item_type === 'remaining_balance')
              
              if (remainingBalanceItem) {
                // Calculate new bill amount without remaining balance
                const newBillAmount = currentBill.amount - remainingBalanceItem.amount
                
                // Update bill amount
                await supabase
                  .from('bills')
                  .update({ 
                    amount: newBillAmount,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', currentBill.id)

                // Remove remaining balance item from bill items
                await supabase
                  .from('bill_items')
                  .delete()
                  .eq('id', remainingBalanceItem.id)

                console.log('Current month bill updated to remove remaining balance from previous month')
              }
            }
          }
        }
      }

      setShowModal(false)
      setEditingPayment(null)
      setFormData({
        tenant_id: '',
        bill_id: '',
        amount_paid: '',
        payment_date: '',
        method: 'gcash',
        reference_number: '',
        received_by: '',
        status: 'accepted',
      })
      setTotalRemainingBill(0)
      fetchData()
    } catch (error) {
      console.error('Error handling payment submission:', error)
      alert('An unexpected error occurred: ' + (error as Error).message)
    }
  }

  const handleMethodChange = (method: 'gcash' | 'bank' | 'in_person') => {
    setFormData(prev => ({
      ...prev,
      method,
      reference_number: '',
      received_by: '',
    }))
  }

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment)
    setFormData({
      bill_id: payment.bill_id,
      tenant_id: payment.tenant_id,
      amount_paid: payment.amount_paid.toString(),
      payment_date: payment.payment_date,
      method: payment.method,
      reference_number: payment.reference_number || '',
      received_by: payment.received_by || '',
      status: payment.status as 'pending' | 'accepted' | 'declined',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) console.error('Error deleting payment:', error)
    fetchData()
  }



  const filteredPayments = payments.filter(payment => 
    tenants.find(t => t.id === payment.tenant_id)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.bill_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.amount_paid.toString().includes(searchTerm) ||
    payment.payment_date.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.method.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (payment.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (payment.received_by || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'gcash': return 'GCash'
      case 'bank': return 'Bank Transfer'
      case 'in_person': return 'In Person'
      default: return method
    }
  }

  // Filter payments by status
  const pendingPayments = filteredPayments.filter(payment => payment.status === 'pending')
  const acceptedPayments = filteredPayments.filter(payment => payment.status === 'accepted')
  const declinedPayments = filteredPayments.filter(payment => payment.status === 'declined')

  // Calculate summary stats
  const pendingTotal = pendingPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
  const acceptedTotal = acceptedPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
  const declinedTotal = declinedPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
          >
            Add Payment
          </button>
      </div>

      {/* Payment Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {/* Pending Payments Card */}
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pending Payments</h3>
            <span className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</span>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-xl font-bold text-gray-900">₱{pendingTotal.toFixed(2)}</p>
          </div>
          {pendingPayments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-yellow-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingPayments.slice(0, 5).map((payment) => {
                    const tenant = tenants.find(t => t.id === payment.tenant_id)
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {tenant?.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          ₱{payment.amount_paid.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {new Date(payment.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium space-x-1">
                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from('payments')
                                .update({ status: 'accepted', updated_at: new Date().toISOString() })
                                .eq('id', payment.id)
                              if (error) {
                                console.error('Error accepting payment:', error)
                                alert('Failed to accept payment: ' + error.message)
                              } else {
                                // Update bill status if payment is accepted
                                if (payment.bill_id) {
                                  const { data: billPayments } = await supabase
                                    .from('payments')
                                    .select('amount_paid')
                                    .eq('bill_id', payment.bill_id)
                                    .eq('status', 'accepted')

                                  const totalPaid = billPayments?.reduce((sum, p) => sum + p.amount_paid, 0) || 0
                                  const bill = bills.find(b => b.id === payment.bill_id)
                                  
                                  if (bill) {
                                    let newStatus: 'pending' | 'paid' | 'overdue' | 'partial' = bill.status
                                    
                                    if (totalPaid >= bill.amount) {
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
                                      .eq('id', payment.bill_id)

                                    // If previous month's bill is now paid in full, update current month's bill to remove remaining balance
                                    if (newStatus === 'paid') {
                                      const currentDate = new Date()
                                      const currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0')
                                      
                                      // Get current month's bill for the same tenant
                                      const { data: currentMonthBills } = await supabase
                                        .from('bills')
                                        .select('*')
                                        .eq('tenant_id', bill.tenant_id)
                                        .ilike('description', `%${currentMonth}%`)

                                      if (currentMonthBills && currentMonthBills.length > 0) {
                                        const currentBill = currentMonthBills[0]
                                        
                                        // Get bill items for current month's bill
                                        const { data: currentBillItems } = await supabase
                                          .from('bill_items')
                                          .select('*')
                                          .eq('bill_id', currentBill.id)

                                        // Check if current bill has remaining balance from previous month
                                        const remainingBalanceItem = currentBillItems?.find(item => item.item_type === 'remaining_balance')
                                        
                                        if (remainingBalanceItem) {
                                          // Calculate new bill amount without remaining balance
                                          const newBillAmount = currentBill.amount - remainingBalanceItem.amount
                                          
                                          // Update bill amount
                                          await supabase
                                            .from('bills')
                                            .update({ 
                                              amount: newBillAmount,
                                              updated_at: new Date().toISOString()
                                            })
                                            .eq('id', currentBill.id)

                                          // Remove remaining balance item from bill items
                                          await supabase
                                            .from('bill_items')
                                            .delete()
                                            .eq('id', remainingBalanceItem.id)

                                          console.log('Current month bill updated to remove remaining balance from previous month')
                                        }
                                      }
                                    }
                                  }
                                }
                                fetchData()
                              }
                            }}
                            className="text-green-600 hover:text-green-900 text-xs"
                          >
                            Accept
                          </button>
                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from('payments')
                                .update({ status: 'declined', updated_at: new Date().toISOString() })
                                .eq('id', payment.id)
                              if (error) {
                                console.error('Error declining payment:', error)
                                alert('Failed to decline payment: ' + error.message)
                              } else {
                                fetchData()
                              }
                            }}
                            className="text-red-600 hover:text-red-900 text-xs"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleEdit(payment)}
                            className="text-blue-600 hover:text-blue-900 text-xs"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pendingPayments.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No pending payments
            </div>
          )}
          {pendingPayments.length > 0 && (
            <div 
              className="text-center py-2 text-sm text-blue-600 hover:text-blue-900 cursor-pointer font-medium"
              onClick={() => {
                setSelectedStatus('pending')
                setShowDetailsModal(true)
              }}
            >
              View all {pendingPayments.length} pending payments
            </div>
          )}
        </div>

        {/* Accepted Payments Card */}
        <div className="card bg-green-50 border-green-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Accepted Payments</h3>
            <span className="text-2xl font-bold text-green-600">{acceptedPayments.length}</span>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-xl font-bold text-gray-900">₱{acceptedTotal.toFixed(2)}</p>
          </div>
          {acceptedPayments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-green-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {acceptedPayments.slice(0, 5).map((payment) => {
                    const tenant = tenants.find(t => t.id === payment.tenant_id)
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {tenant?.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          ₱{payment.amount_paid.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {new Date(payment.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium space-x-1">
                          <button
                            onClick={() => handleEdit(payment)}
                            className="text-blue-600 hover:text-blue-900 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="text-red-600 hover:text-red-900 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {acceptedPayments.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No accepted payments
            </div>
          )}
          {acceptedPayments.length > 0 && (
            <div 
              className="text-center py-2 text-sm text-blue-600 hover:text-blue-900 cursor-pointer font-medium"
              onClick={() => {
                setSelectedStatus('accepted')
                setShowDetailsModal(true)
              }}
            >
              View all {acceptedPayments.length} accepted payments
            </div>
          )}
        </div>

        {/* Declined Payments Card */}
        <div className="card bg-red-50 border-red-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Declined Payments</h3>
            <span className="text-2xl font-bold text-red-600">{declinedPayments.length}</span>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-xl font-bold text-gray-900">₱{declinedTotal.toFixed(2)}</p>
          </div>
          {declinedPayments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {declinedPayments.slice(0, 5).map((payment) => {
                    const tenant = tenants.find(t => t.id === payment.tenant_id)
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {tenant?.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          ₱{payment.amount_paid.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {new Date(payment.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium space-x-1">
                          <button
                            onClick={() => handleEdit(payment)}
                            className="text-blue-600 hover:text-blue-900 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="text-red-600 hover:text-red-900 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {declinedPayments.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No declined payments
            </div>
          )}
          {declinedPayments.length > 0 && (
            <div 
              className="text-center py-2 text-sm text-blue-600 hover:text-blue-900 cursor-pointer font-medium"
              onClick={() => {
                setSelectedStatus('declined')
                setShowDetailsModal(true)
              }}
            >
              View all {declinedPayments.length} declined payments
            </div>
          )}
        </div>
      </div>

      {/* Payments Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Payments
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="card">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenant
                      </th>
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
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      const statusPayments = selectedStatus === 'pending' ? pendingPayments : 
                                            selectedStatus === 'accepted' ? acceptedPayments : declinedPayments
                      
                      return statusPayments.map((payment) => {
                        const tenant = tenants.find(t => t.id === payment.tenant_id)
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
                              <span className="font-medium text-gray-900">
                                {tenant?.name}
                              </span>
                            </td>
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
                              <span className={`font-medium ₱{
                                remaining > 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                ₱{remaining.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {new Date(payment.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                {payment.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={async () => {
                                        const { error } = await supabase
                                          .from('payments')
                                          .update({ status: 'accepted', updated_at: new Date().toISOString() })
                                          .eq('id', payment.id)
                                        if (error) {
                                          console.error('Error accepting payment:', error)
                                          alert('Failed to accept payment: ' + error.message)
                                        } else {
                                          // Update bill status if payment is accepted
                                          if (payment.bill_id) {
                                            const { data: billPayments } = await supabase
                                              .from('payments')
                                              .select('amount_paid')
                                              .eq('bill_id', payment.bill_id)
                                              .eq('status', 'accepted')

                                            const totalPaid = billPayments?.reduce((sum, p) => sum + p.amount_paid, 0) || 0
                                            const bill = bills.find(b => b.id === payment.bill_id)
                                            
                                            if (bill) {
                                              let newStatus: 'pending' | 'paid' | 'overdue' | 'partial' = bill.status
                                              
                                              if (totalPaid >= bill.amount) {
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
                                                .eq('id', payment.bill_id)

                                              // If previous month's bill is now paid in full, update current month's bill to remove remaining balance
                                              if (newStatus === 'paid') {
                                                const currentDate = new Date()
                                                const currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0')
                                                
                                                // Get current month's bill for the same tenant
                                                const { data: currentMonthBills } = await supabase
                                                  .from('bills')
                                                  .select('*')
                                                  .eq('tenant_id', bill.tenant_id)
                                                  .ilike('description', `%${currentMonth}%`)

                                                if (currentMonthBills && currentMonthBills.length > 0) {
                                                  const currentBill = currentMonthBills[0]
                                                  
                                                  // Get bill items for current month's bill
                                                  const { data: currentBillItems } = await supabase
                                                    .from('bill_items')
                                                    .select('*')
                                                    .eq('bill_id', currentBill.id)

                                                  // Check if current bill has remaining balance from previous month
                                                  const remainingBalanceItem = currentBillItems?.find(item => item.item_type === 'remaining_balance')
                                                  
                                                  if (remainingBalanceItem) {
                                                    // Calculate new bill amount without remaining balance
                                                    const newBillAmount = currentBill.amount - remainingBalanceItem.amount
                                                    
                                                    // Update bill amount
                                                    await supabase
                                                      .from('bills')
                                                      .update({ 
                                                        amount: newBillAmount,
                                                        updated_at: new Date().toISOString()
                                                      })
                                                      .eq('id', currentBill.id)

                                                    // Remove remaining balance item from bill items
                                                    await supabase
                                                      .from('bill_items')
                                                      .delete()
                                                      .eq('id', remainingBalanceItem.id)

                                                    console.log('Current month bill updated to remove remaining balance from previous month')
                                                  }
                                                }
                                              }
                                            }
                                          }
                                          fetchData()
                                        }
                                      }}
                                      className="text-green-600 hover:text-green-900"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const { error } = await supabase
                                          .from('payments')
                                          .update({ status: 'declined', updated_at: new Date().toISOString() })
                                          .eq('id', payment.id)
                                        if (error) {
                                          console.error('Error declining payment:', error)
                                          alert('Failed to decline payment: ' + error.message)
                                        } else {
                                          fetchData()
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      Decline
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleEdit(payment)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(payment.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-md mx-4 my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {editingPayment ? 'Edit Payment' : 'Add Payment'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Tenant</label>
                <select
                  value={formData.tenant_id}
                  onChange={(e) => {
                    const tenantId = e.target.value
                    setFormData({
                      ...formData,
                      tenant_id: tenantId
                    })
                    if (tenantId) {
                      calculateTotalRemainingBill(tenantId)
                    } else {
                      setTotalRemainingBill(0)
                      setFormData(prev => ({
                        ...prev,
                        bill_id: ''
                      }))
                    }
                  }}
                  className="input-field"
                  required
                >
                  <option value="">Select Tenant</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>



              <div>
                <label className="label">Bill (Optional)</label>
                <select
                  value={formData.bill_id}
                  onChange={(e) => setFormData({ ...formData, bill_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select Bill (Optional)</option>
                  {bills.filter(bill => bill.tenant_id === formData.tenant_id).map((bill) => {
                    const tenant = tenants.find(t => t.id === bill.tenant_id)
                    const remaining = getBillRemainingBalance(bill.id)
                    return (
                      <option key={bill.id} value={bill.id}>
                         Bill #{bill.id.slice(0, 8)} - ₱{bill.amount.toFixed(2)} (Remaining: ₱{remaining.toFixed(2)}) - Due: {new Date(bill.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                    className="input-field"
                    required
                    placeholder="Enter amount"
                  />
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
                  className="input-field"
                  required
                />
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
              </div>

              {formData.method && formData.method !== 'in_person' && (
                <div>
                  <label className="label">Reference Number</label>
                  <input
                    type="text"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    className="input-field"
                    required
                    placeholder="Enter reference number"
                  />
                </div>
              )}

              {formData.method === 'in_person' && (
                <div>
                  <label className="label">Received By</label>
                  <input
                    type="text"
                    value={formData.received_by}
                    onChange={(e) => setFormData({ ...formData, received_by: e.target.value })}
                    className="input-field"
                    required
                    placeholder="Enter name of person who received payment"
                  />
                </div>
              )}
              <div>
                <label className="label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="input-field"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingPayment(null)
                    setFormData({
                      tenant_id: '',
                      bill_id: '',
                      amount_paid: '',
                      payment_date: '',
                      method: 'gcash',
                      reference_number: '',
                      received_by: '',
                      status: 'accepted',
                    })
                    setTotalRemainingBill(0)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors">
                  {editingPayment ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
