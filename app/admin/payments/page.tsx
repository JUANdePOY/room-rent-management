'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Payment, Bill, Tenant, BillItem, Room } from '../../../types'
import { calculateTotalBill, calculateRemainingBill, calculateTotalPaid } from '../../../lib/billingUtils'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all')

  // Handle closing modals with ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showModal) {
          setShowModal(false)
          setEditingPayment(null)
          setFormData({
            room_id: '',
            bill_id: '',
            amount_paid: '',
            payment_date: '',
            method: 'gcash',
            reference_number: '',
            received_by: '',
            status: 'accepted',
          })
          setTotalRemainingBill(0)
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showModal])

  // Handle closing modals by clicking outside
  const handleModalOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (showModal) {
        setShowModal(false)
        setEditingPayment(null)
        setFormData({
          room_id: '',
          bill_id: '',
          amount_paid: '',
          payment_date: '',
          method: 'gcash',
          reference_number: '',
          received_by: '',
          status: 'accepted',
        })
        setTotalRemainingBill(0)
      }
    }
  }

  const [formData, setFormData] = useState({
    room_id: '',
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
    return calculateRemainingBill(bill, payments)
  }
  const [totalRemainingBill, setTotalRemainingBill] = useState<number>(0)

  useEffect(() => {
    fetchData()
  }, [])

  const calculateTotalRemainingBill = (roomId: string) => {
    // Get current month
    const currentDate = new Date()
    const currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0')
    
    // Get current month's bill for the room
    const currentMonthBills = bills.filter(bill => {
      return bill.room_id === roomId && bill.description?.includes(currentMonth)
    })
    
    if (currentMonthBills.length > 0) {
      const currentBill = currentMonthBills[0]
      const remaining = calculateRemainingBill(currentBill, payments)
      setTotalRemainingBill(remaining)
      setFormData(prev => ({ ...prev, bill_id: currentBill.id }))
    } else {
      // If no current month bill, check for pending bills from previous months
      const pendingBills = bills.filter(bill => {
        const remaining = calculateRemainingBill(bill, payments)
        return bill.room_id === roomId && remaining > 0
      })
      
      if (pendingBills.length > 0) {
        const latestPendingBill = pendingBills.sort((a, b) =>
          new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
        )[0]
        const remaining = calculateRemainingBill(latestPendingBill, payments)
        setTotalRemainingBill(remaining)
        setFormData(prev => ({ ...prev, bill_id: latestPendingBill.id }))
      } else {
        setTotalRemainingBill(0)
        setFormData(prev => ({ ...prev, bill_id: '' }))
      }
    }
  }

  const [billItems, setBillItems] = useState<BillItem[]>([])

  const fetchData = async () => {
    try {
      const [paymentsData, billsData, tenantsData, roomsData, billItemsData] = await Promise.all([
        supabase.from('payments').select('*'),
        supabase.from('bills').select('*'),
        supabase.from('tenants').select('*'),
        supabase.from('rooms').select('*'),
        supabase.from('bill_items').select('*'),
      ])

      if (paymentsData.error) {
        console.error('Error fetching payments:', paymentsData.error)
        alert('Failed to fetch payments: ' + paymentsData.error.message)
      } else if (paymentsData.data) {
        // Sort payments by payment date (newest first)
        const sortedPayments = [...paymentsData.data].sort((a, b) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )
        setPayments(sortedPayments)
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

      if (roomsData.error) {
        console.error('Error fetching rooms:', roomsData.error)
        alert('Failed to fetch rooms: ' + roomsData.error.message)
      } else if (roomsData.data) {
        setRooms(roomsData.data)
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
    const { bill_id, amount_paid, payment_date, method, reference_number, received_by, status } = formData

    try {
      if (editingPayment) {
        const { error } = await supabase
          .from('payments')
          .update({
            bill_id,
            amount_paid: parseFloat(amount_paid),
            payment_date,
            method,
            reference_number,
            received_by,
            status,
            updated_at: new Date().toISOString()
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
          tenant_id: tenants.find(t => t.room_id === formData.room_id)?.id,
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

      setShowModal(false)
      setEditingPayment(null)
      setFormData({
        room_id: '',
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
    const tenant = tenants.find(t => t.id === payment.tenant_id)
    setFormData({
      bill_id: payment.bill_id || '',
      room_id: tenant?.room_id || '',
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

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    const matchesStatus = selectedStatus === 'all' || payment.status === selectedStatus
    const matchesSearch = 
      tenants.find(t => t.id === payment.tenant_id)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.bill_id ? payment.bill_id.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
      payment.amount_paid.toString().includes(searchTerm) ||
      payment.payment_date.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.method.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.received_by || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.status.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

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
  const totalPayments = filteredPayments.length
  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
          <p className="text-gray-600 mt-1">Manage all payment transactions</p>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900">{totalPayments}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">₱{totalAmount.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Pending Payments</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Accepted Payments</p>
          <p className="text-2xl font-bold text-green-600">{acceptedPayments.length}</p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'accepted', 'declined'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
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
              {filteredPayments.map((payment, index) => {
                const tenant = tenants.find(t => t.id === payment.tenant_id)
                return (
                  <tr 
                    key={payment.id} 
                    className={`${
                      index === 0 ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                    } transition-colors`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{tenant?.name}</span>
                        {tenant?.room_id && (
                          <span className="text-sm text-gray-500">Room {rooms.find(r => r.id === tenant.room_id)?.room_number}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">
                          #{payment.id.slice(0, 8)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getMethodLabel(payment.method)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-semibold text-gray-900">
                        ₱{payment.amount_paid.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                        payment.status === 'accepted' ? 'bg-green-100 text-green-800' : 
                        payment.status === 'declined' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
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
                                      .eq('id', payment.bill_id)
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
                        </>
                      )}
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
        {filteredPayments.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg text-gray-600 mb-2">No payments found</p>
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

      {/* Add/Edit Payment Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
          onClick={handleModalOverlayClick}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {editingPayment ? 'Edit Payment' : 'Add Payment'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                <select
                  value={formData.room_id}
                  onChange={(e) => {
                    const roomId = e.target.value
                    setFormData(prev => ({ ...prev, room_id: roomId }))
                    calculateTotalRemainingBill(roomId)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="">Select Room</option>
                  {rooms.filter(room => room.status === 'occupied').map((room) => {
                    const tenant = tenants.find(t => t.room_id === room.id)
                    return (
                      <option key={room.id} value={room.id}>
                        Room {room.room_number} - {tenant?.name || 'Vacant'}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount_paid}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount_paid: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <div className="space-y-2">
                  {(['gcash', 'bank', 'in_person'] as const).map((method) => (
                    <label key={method} className="flex items-center">
                      <input
                        type="radio"
                        value={method}
                        checked={formData.method === method}
                        onChange={() => handleMethodChange(method)}
                        className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-900">{getMethodLabel(method)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formData.method && (
                <>
                  {formData.method !== 'in_person' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                      <input
                        type="text"
                        value={formData.reference_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                      />
                    </div>
                  )}
                  {formData.method === 'in_person' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                      <input
                        type="text"
                        value={formData.received_by}
                        onChange={(e) => setFormData(prev => ({ ...prev, received_by: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'pending' | 'accepted' | 'declined' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
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
                      room_id: '',
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
