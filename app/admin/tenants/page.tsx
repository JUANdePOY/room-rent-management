'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tenant, Room, User, Bill, Payment, BillItem, Deposit } from '../../../types'
import { calculateTotalBill, calculateRemainingBill, calculateTotalPaid } from '../../../lib/billingUtils'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantDetails, setTenantDetails] = useState<{
    room: Room | null
    bills: Bill[]
    payments: Payment[]
    user: User | null
    deposits: Deposit[]
  }>({ room: null, bills: [], payments: [], user: null, deposits: [] })
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [formData, setFormData] = useState({
    user_id: '',
    room_id: '',
    name: '',
    contact: '',
    start_date: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    email: '',
    password: '',
    deposit_amount: '',
  })
  const [showAddDepositModal, setShowAddDepositModal] = useState(false)
  const [depositFormData, setDepositFormData] = useState<{
    amount: string
    deposit_date: string
    method: 'gcash' | 'bank' | 'in_person'
    reference_number: string
    received_by: string
    notes: string
  }>({
    amount: '',
    deposit_date: new Date().toISOString().split('T')[0],
    method: 'in_person',
    reference_number: '',
    received_by: '',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [tenantsData, roomsData, usersData] = await Promise.all([
      supabase.from('tenants').select('*'),
      supabase.from('rooms').select('*'),
      supabase.from('users').select('*').eq('role', 'tenant'),
    ])

    if (tenantsData.data) setTenants(tenantsData.data)
    if (roomsData.data) setRooms(roomsData.data)
    if (usersData.data) setUsers(usersData.data)
    setLoading(false)
  }

  const fetchTenantDetails = async (tenant: Tenant) => {
    // Fetch room
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', tenant.room_id)
      .single()

    if (roomError) console.error('Error fetching room:', roomError)

    // Fetch user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', tenant.user_id)
      .single()

    if (userError) console.error('Error fetching user:', userError)

    // Fetch bills
    const { data: billsData, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('due_date', { ascending: false })

    if (billsError) console.error('Error fetching bills:', billsError)

    // Fetch bill items
    const { data: billItemsData, error: billItemsError } = await supabase
      .from('bill_items')
      .select('*')

    if (billItemsError) console.error('Error fetching bill items:', billItemsError)

    // Fetch payments
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('payment_date', { ascending: false })

    if (paymentsError) console.error('Error fetching payments:', paymentsError)

    // Fetch deposits
    const { data: depositsData, error: depositsError } = await supabase
      .from('deposits')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('deposit_date', { ascending: false })

    if (depositsError) console.error('Error fetching deposits:', depositsError)

    // Calculate total paid and remaining for each bill
    const billsWithCalculations = (billsData || []).map(bill => {
      const items = (billItemsData || []).filter(item => item.bill_id === bill.id)
      const totalPaid = calculateTotalPaid(bill, paymentsData || [])
      const remaining = calculateRemainingBill(bill, paymentsData || [])

      return {
        ...bill,
        items,
        totalPaid,
        remaining,
      }
    })

    setTenantDetails({
      room: roomData || null,
      bills: billsWithCalculations,
      payments: paymentsData || [],
      user: userData || null,
      deposits: depositsData || [],
    })
  }

  const handleViewDetails = async (tenant: Tenant) => {
    setSelectedTenant(tenant)
    await fetchTenantDetails(tenant)
    setShowDetailsModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { user_id, room_id, name, contact, start_date, emergency_contact_name, emergency_contact_number, email, password } = formData

    if (editingTenant) {
      console.log('Updating tenant:', editingTenant.id)
      console.log('Update data:', {
        user_id,
        room_id,
        name,
        contact,
        start_date,
        emergency_contact_name,
        emergency_contact_number,
        updated_at: new Date().toISOString()
      })
      
      try {
        const { error } = await supabase
          .from('tenants')
          .update({
            user_id,
            room_id,
            name,
            contact,
            start_date,
            emergency_contact_name,
            emergency_contact_number,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTenant.id)
          
        if (error) {
          console.error('Error updating tenant:', error)
          alert('Failed to update tenant: ' + error.message)
        } else {
          console.log('Tenant updated successfully')
        }
      } catch (error) {
        console.error('Error updating tenant:', error)
        alert('Failed to update tenant: ' + (error as Error).message)
      }
    } else {
      // Create user first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) {
        console.error('Error creating user:', authError)
        alert('Failed to create user: ' + authError.message)
        return
      }

      if (authData.user) {
        // Create user record in users table
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            role: 'tenant',
          })

        if (userError) {
          console.error('Error creating user record:', userError)
          alert('Failed to create user record: ' + userError.message)
          return
        }

        // Create tenant record
        const { error: tenantError } = await supabase.from('tenants').insert({
          user_id: authData.user.id,
          room_id,
          name,
          contact,
          start_date,
          emergency_contact_name,
          emergency_contact_number,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (tenantError) {
          console.error('Error creating tenant:', tenantError)
          alert('Failed to create tenant: ' + tenantError.message)
          return
        }

        // Update room status to occupied
        await supabase
          .from('rooms')
          .update({ status: 'occupied' })
          .eq('id', room_id)

        // Add deposit if amount is provided
        if (formData.deposit_amount) {
          await supabase.from('deposits').insert({
            tenant_id: authData.user?.id,
            room_id,
            amount: parseFloat(formData.deposit_amount),
            deposit_date: formData.start_date,
            status: 'active',
            method: 'in_person', // Default method
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      }
    }

    setShowModal(false)
    setEditingTenant(null)
    setFormData({
      user_id: '',
      room_id: '',
      name: '',
      contact: '',
      start_date: '',
      emergency_contact_name: '',
      emergency_contact_number: '',
      email: '',
      password: '',
      deposit_amount: '',
    })
    fetchData()
  }

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant)
    const user = users.find(u => u.id === tenant.user_id)
    setFormData({
      user_id: tenant.user_id,
      room_id: tenant.room_id,
      name: tenant.name,
      contact: tenant.contact,
      start_date: tenant.start_date,
      emergency_contact_name: tenant.emergency_contact_name,
      emergency_contact_number: tenant.emergency_contact_number,
      email: user?.email || '',
      password: '', // Don't show password when editing
      deposit_amount: '', // Don't show deposit when editing
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tenant?')) return
    const { error } = await supabase.from('tenants').delete().eq('id', id)
    if (error) console.error('Error deleting tenant:', error)
    fetchData()
  }

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenant) return

    const { amount, deposit_date, method, reference_number, received_by, notes } = depositFormData

    const { error } = await supabase.from('deposits').insert({
      tenant_id: selectedTenant.id,
      room_id: selectedTenant.room_id,
      amount: parseFloat(amount),
      deposit_date,
      status: 'active',
      method,
      reference_number: reference_number || null,
      received_by: received_by || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Error adding deposit:', error)
      alert('Failed to add deposit: ' + error.message)
    } else {
      setShowAddDepositModal(false)
      setDepositFormData({
        amount: '',
        deposit_date: new Date().toISOString().split('T')[0],
        method: 'in_person',
        reference_number: '',
        received_by: '',
        notes: '',
      })
      await fetchTenantDetails(selectedTenant)
    }
  }

  const handleRefundDeposit = async (deposit: Deposit) => {
    if (!confirm('Are you sure you want to refund this deposit?')) return

    const { error } = await supabase
      .from('deposits')
      .update({
        status: 'refunded',
        refund_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deposit.id)

    if (error) {
      console.error('Error refunding deposit:', error)
      alert('Failed to refund deposit: ' + error.message)
    } else {
      if (selectedTenant) {
        await fetchTenantDetails(selectedTenant)
      }
    }
  }

  const handleForfeitDeposit = async (deposit: Deposit) => {
    if (!confirm('Are you sure you want to forfeit this deposit?')) return

    const { error } = await supabase
      .from('deposits')
      .update({
        status: 'forfeited',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deposit.id)

    if (error) {
      console.error('Error forfeiting deposit:', error)
      alert('Failed to forfeit deposit: ' + error.message)
    } else {
      if (selectedTenant) {
        await fetchTenantDetails(selectedTenant)
      }
    }
  }

  const filteredTenants = tenants.filter(tenant => 
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rooms.find(r => r.id === tenant.room_id)?.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    users.find(u => u.id === tenant.user_id)?.email.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex justify-between items-center">
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search tenants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
         <div className="flex space-x-4">
            <button
             onClick={() => setShowModal(true)}
             className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
           >
             Add Tenant
           </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredTenants.map((tenant) => {
          const room = rooms.find(r => r.id === tenant.room_id)
          const user = users.find(u => u.id === tenant.user_id)
          return (
            <div
              key={tenant.id}
              className="group relative transform-style-preserve-3d transition-all duration-500 hover:translate-y-[-6px] hover:rotateX-2 hover:rotateY-2"
            >
              {/* 3D Card Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg transform translate-z-[-1px] blur-md opacity-50 group-hover:opacity-70 transition-all duration-300 group-hover:blur-lg"></div>
              <div className="bg-white rounded-lg shadow-lg p-4 transform translate-z-0 relative transition-all duration-300 group-hover:shadow-2xl group-hover:border-t-4 group-hover:border-blue-500">
                {/* Tenant Name */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {tenant.name}
                </h3>

                {/* Email */}
                <p className="text-gray-600 mb-1 text-sm">{user?.email}</p>

                {/* Contact */}
                <p className="text-gray-600 mb-4 text-sm">{tenant.contact}</p>

                {/* Room Information */}
                <div className="mb-4">
                  <p className="text-gray-500 text-sm mb-1">Room</p>
                  <p className="font-semibold text-gray-900">{room?.room_number || 'N/A'}</p>
                </div>

                {/* Start Date */}
                <div className="mb-4">
                  <p className="text-gray-500 text-sm mb-1">Start Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(tenant.start_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                 {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleViewDetails(tenant)}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleEdit(tenant)}
                    className="px-3 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tenant.id)}
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

      {/* Tenant Details Modal */}
      {showDetailsModal && selectedTenant && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                {selectedTenant.name} Details
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Personal Information</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{selectedTenant.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{tenantDetails.user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Contact</p>
                    <p className="font-medium">{selectedTenant.contact}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="font-medium">{new Date(selectedTenant.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* Room Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Room Information</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">Room Number</p>
                    <p className="font-medium">{tenantDetails.room?.room_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Room Type</p>
                    <p className="font-medium">{tenantDetails.room?.type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Rent Amount</p>
                    <p className="font-medium">₱{tenantDetails.room?.rent_amount.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Emergency Contact</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{selectedTenant.emergency_contact_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone Number</p>
                    <p className="font-medium">{selectedTenant.emergency_contact_number}</p>
                  </div>
                </div>
              </div>
            </div>

              {/* Bills and Payments */}
              <div className="mt-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Billing and Payments</h4>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                          <dd className="text-lg font-medium text-gray-900">₱{tenantDetails.bills.reduce((sum, bill) => sum + bill.amount, 0).toFixed(2)}</dd>
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
                          <dd className="text-lg font-medium text-gray-900">₱{tenantDetails.bills.reduce((sum, bill) => sum + (bill as any).totalPaid, 0).toFixed(2)}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 ${tenantDetails.bills.reduce((sum, bill) => sum + (bill as any).remaining, 0) > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} rounded-full flex items-center justify-center`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Remaining Balance</dt>
                          <dd className={`text-lg font-medium ${tenantDetails.bills.reduce((sum, bill) => sum + (bill as any).remaining, 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>₱{tenantDetails.bills.reduce((sum, bill) => sum + (bill as any).remaining, 0).toFixed(2)}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Deposits</dt>
                          <dd className="text-lg font-medium text-gray-900">₱{tenantDetails.deposits.reduce((sum, deposit) => sum + deposit.amount, 0).toFixed(2)}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deposits */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h5 className="text-md font-medium text-gray-900">Deposits</h5>
                    <button
                      onClick={() => setShowAddDepositModal(true)}
                      className="px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Add Deposit
                    </button>
                  </div>
                  
                  {tenantDetails.deposits.length > 0 ? (
                    <div className="space-y-2">
                      {tenantDetails.deposits.map((deposit) => (
                        <div key={deposit.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">
                              {new Date(deposit.deposit_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              deposit.status === 'active' ? 'bg-purple-100 text-purple-800' :
                              deposit.status === 'refunded' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {deposit.status}
                            </span>
                            {deposit.notes && (
                              <p className="text-sm text-gray-500 mt-1">{deposit.notes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">₱{deposit.amount.toFixed(2)}</p>
                            <p className="text-sm text-gray-500">Method: {deposit.method}</p>
                            {deposit.status === 'active' && (
                              <div className="flex gap-1 mt-1">
                                <button
                                  onClick={() => handleRefundDeposit(deposit)}
                                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                                >
                                  Refund
                                </button>
                                <button
                                  onClick={() => handleForfeitDeposit(deposit)}
                                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                                >
                                  Forfeit
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No deposit records for this tenant.
                    </div>
                  )}
                </div>

                {tenantDetails.bills.length === 0 && tenantDetails.payments.length === 0 && tenantDetails.deposits.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No billing, payment, or deposit records for this tenant.
                  </div>
                )}
              </div>
          </div>
        </div>
      )}

      {/* Add Deposit Modal */}
      {showAddDepositModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50 p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-md mx-4 my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Add Deposit
            </h3>
            <form onSubmit={handleAddDeposit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={depositFormData.amount}
                  onChange={(e) => setDepositFormData({ ...depositFormData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deposit Date
                </label>
                <input
                  type="date"
                  required
                  value={depositFormData.deposit_date}
                  onChange={(e) => setDepositFormData({ ...depositFormData, deposit_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={depositFormData.method}
                  onChange={(e) => setDepositFormData({ 
                    ...depositFormData, 
                    method: e.target.value as unknown as 'gcash' | 'bank' | 'in_person' 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="in_person">In Person</option>
                  <option value="gcash">GCash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={depositFormData.reference_number}
                  onChange={(e) => setDepositFormData({ ...depositFormData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Received By
                </label>
                <input
                  type="text"
                  value={depositFormData.received_by}
                  onChange={(e) => setDepositFormData({ ...depositFormData, received_by: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={depositFormData.notes}
                  onChange={(e) => setDepositFormData({ ...depositFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddDepositModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Add Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Tenant Modal */}
      {showModal && (
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50 p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-md mx-4 my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {editingTenant ? 'Edit Tenant' : 'Add Tenant'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Form fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                 <select
                   value={formData.room_id}
                   onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                 >
                   <option value="">Select a room</option>
                   {rooms.filter(room => room.status === 'available' || (editingTenant && room.id === editingTenant.room_id)).map(room => (
                     <option key={room.id} value={room.id}>{room.room_number} - {room.type}</option>
                   ))}
                 </select>
               </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Number</label>
                <input
                  type="text"
                  value={formData.emergency_contact_number}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.deposit_amount}
                  onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingTenant(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors">
                  {editingTenant ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
