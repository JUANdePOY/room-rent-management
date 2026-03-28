'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Room, Tenant, Bill, Payment } from '../../../types'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('room_number')
  const [sortOrder, setSortOrder] = useState('asc')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [roomDetails, setRoomDetails] = useState<{
    tenant: Tenant | null
    bills: Bill[]
    payments: Payment[]
  }>({ tenant: null, bills: [], payments: [] })
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [formData, setFormData] = useState({
    room_number: '',
    type: '',
    rent_amount: '',
    status: 'available' as 'available' | 'occupied' | 'maintenance',
    description: '',
    electric_meter_number: '',
    initial_electric_reading: '',
    electric_included: false,
    max_occupancy: '1',
    deposit_amount: '',
  })

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    const { data, error } = await supabase.from('rooms').select('*')
    if (error) console.error('Error fetching rooms:', error)
    else setRooms(data || [])
    setLoading(false)
  }

  const fetchRoomDetails = async (roomId: string) => {
    // Fetch tenant
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (tenantError && tenantError.code !== 'PGRST116') {
      console.error('Error fetching tenant:', tenantError)
    }

    const tenant = tenantData || null

    // Fetch bills
    const { data: billsData, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('room_id', roomId)
      .order('due_date', { ascending: false })

    if (billsError) console.error('Error fetching bills:', billsError)

    // Fetch payments
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenant?.id || '')
      .order('payment_date', { ascending: false })

    if (paymentsError) console.error('Error fetching payments:', paymentsError)

    setRoomDetails({
      tenant,
      bills: billsData || [],
      payments: paymentsData || [],
    })
  }

  const handleViewDetails = async (room: Room) => {
    setSelectedRoom(room)
    await fetchRoomDetails(room.id)
    setShowDetailsModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { 
      room_number, 
      type, 
      rent_amount, 
      status, 
      description,
      electric_meter_number,
      initial_electric_reading,
      electric_included,
      max_occupancy,
      deposit_amount
    } = formData

    if (editingRoom) {
      const { error } = await supabase
        .from('rooms')
        .update({
          room_number,
          type,
          rent_amount: parseFloat(rent_amount),
          status,
          description,
          electric_meter_number,
          initial_electric_reading: parseFloat(initial_electric_reading || '0'),
          electric_included,
          max_occupancy: parseInt(max_occupancy || '1'),
          deposit_amount: parseFloat(deposit_amount || '0'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingRoom.id)
      if (error) console.error('Error updating room:', error)
    } else {
      const { error } = await supabase.from('rooms').insert({
        room_number,
        type,
        rent_amount: parseFloat(rent_amount),
        status,
        description,
        electric_meter_number,
        initial_electric_reading: parseFloat(initial_electric_reading || '0'),
        electric_included,
        max_occupancy: parseInt(max_occupancy || '1'),
        deposit_amount: parseFloat(deposit_amount || '0'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (error) console.error('Error creating room:', error)
    }

    setShowModal(false)
    setEditingRoom(null)
    setFormData({
      room_number: '',
      type: '',
      rent_amount: '',
      status: 'available',
      description: '',
      electric_meter_number: '',
      initial_electric_reading: '',
      electric_included: false,
      max_occupancy: '1',
      deposit_amount: '',
    })
    fetchRooms()
  }

  const handleEdit = (room: Room) => {
    setEditingRoom(room)
    setFormData({
      room_number: room.room_number,
      type: room.type,
      rent_amount: room.rent_amount.toString(),
      status: room.status,
      description: room.description || '',
      electric_meter_number: room.electric_meter_number || '',
      initial_electric_reading: room.initial_electric_reading?.toString() || '',
      electric_included: room.electric_included ?? false,
      max_occupancy: room.max_occupancy?.toString() || '1',
      deposit_amount: room.deposit_amount?.toString() || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) console.error('Error deleting room:', error)
    fetchRooms()
  }

  // Filter and sort rooms
  const filteredRooms = rooms
    .filter(room => {
      // Search filter
      const matchesSearch = 
        room.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (room.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.status.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Status filter
      const matchesStatus = filterStatus === 'all' || room.status === filterStatus
      
      // Type filter
      const matchesType = filterType === 'all' || room.type.toLowerCase() === filterType.toLowerCase()
      
      return matchesSearch && matchesStatus && matchesType
    })
    .sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'room_number':
          // Handle numerical room numbers properly
          const aNum = parseInt(a.room_number)
          const bNum = parseInt(b.room_number)
          if (!isNaN(aNum) && !isNaN(bNum)) {
            aValue = aNum
            bValue = bNum
          } else {
            aValue = a.room_number.toLowerCase()
            bValue = b.room_number.toLowerCase()
          }
          break
        case 'type':
          aValue = a.type.toLowerCase()
          bValue = b.type.toLowerCase()
          break
        case 'rent_amount':
          aValue = a.rent_amount
          bValue = b.rent_amount
          break
        case 'status':
          aValue = a.status.toLowerCase()
          bValue = b.status.toLowerCase()
          break
        default:
          aValue = a.room_number.toLowerCase()
          bValue = b.room_number.toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
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
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
           <div className="flex space-x-4">
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
            >
              Add Room
            </button>
          </div>
        </div>

        {/* Filter and Sort Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Sort By */}
          <div className="flex items-center gap-2">
            <label htmlFor="sortBy" className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="room_number">Room Number</option>
              <option value="type">Type</option>
              <option value="rent_amount">Rent Amount</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
              title={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="filterStatus" className="text-sm font-medium text-gray-700">Status:</label>
            <select
              id="filterStatus"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="filterType" className="text-sm font-medium text-gray-700">Type:</label>
            <select
              id="filterType"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All</option>
              {Array.from(new Set(rooms.map(room => room.type.toLowerCase()))).map(type => (
                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredRooms.map((room) => (
          <div
            key={room.id}
            className="group relative transform-style-preserve-3d transition-all duration-500 hover:translate-y-[-6px] hover:rotateX-2 hover:rotateY-2"
          >
            {/* 3D Card Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg transform translate-z-[-1px] blur-md opacity-50 group-hover:opacity-70 transition-all duration-300 group-hover:blur-lg"></div>
            <div className="bg-white rounded-lg shadow-lg p-4 transform translate-z-0 relative transition-all duration-300 group-hover:shadow-2xl group-hover:border-t-4 group-hover:border-blue-500">
              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ₱{
                  room.status === 'available'
                    ? 'bg-green-100 text-green-800'
                    : room.status === 'occupied'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {room.status}
                </span>
              </div>

              {/* Room Number */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {room.room_number}
              </h3>

              {/* Room Type */}
              <p className="text-gray-600 mb-1 text-sm font-medium">{room.type}</p>

              {/* Rent Amount */}
              <div className="mb-4">
                <p className="text-gray-500 text-sm mb-1">Rent Amount</p>
                <p className="text-lg font-semibold text-gray-900">₱{room.rent_amount.toFixed(2)}</p>
              </div>

              {/* Description */}
              {room.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{room.description}</p>
              )}

              {/* Amenities */}
              <div className="flex flex-wrap gap-2 mb-4">
                {room.electric_included && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Electricity Included
                  </span>
                )}
              </div>

               {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleViewDetails(room)}
                  className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleEdit(room)}
                  className="px-3 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(room.id)}
                  className="px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Room Details Modal */}
      {showDetailsModal && selectedRoom && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-[calc(100%-1rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Room {selectedRoom.room_number} Details
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
              {/* Room Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Room Information</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="font-medium">{selectedRoom.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Rent Amount</p>
                    <p className="font-medium">₱{selectedRoom.rent_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ₱{
                      selectedRoom.status === 'available'
                        ? 'bg-green-100 text-green-800'
                        : selectedRoom.status === 'occupied'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedRoom.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Max Occupancy</p>
                    <p className="font-medium">{selectedRoom.max_occupancy || 1} person(s)</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Deposit Amount</p>
                    <p className="font-medium">₱{selectedRoom.deposit_amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Meter Numbers</p>
                    <p className="font-medium">Electric: {selectedRoom.electric_meter_number || 'N/A'}</p>
                  </div>
                </div>

                {selectedRoom.description && (
                  <div>
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="font-medium">{selectedRoom.description}</p>
                  </div>
                )}
              </div>

              {/* Tenant Information */}
              {roomDetails.tenant && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Current Tenant</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{roomDetails.tenant.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Contact</p>
                      <p className="font-medium">{roomDetails.tenant.contact}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Start Date</p>
                      <p className="font-medium">{new Date(roomDetails.tenant.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Emergency Contact</p>
                      <p className="font-medium">{roomDetails.tenant.emergency_contact_name}</p>
                      <p className="font-medium">{roomDetails.tenant.emergency_contact_number}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bills and Payments */}
            {roomDetails.tenant && (
              <div className="mt-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Billing and Payments</h4>

                {/* Bills */}
                {roomDetails.bills.length > 0 && (
                  <div className="mb-6">
                    <h5 className="text-md font-medium text-gray-900 mb-3">Bills</h5>
                    <div className="space-y-2">
                      {roomDetails.bills.map((bill) => (
                        <div key={bill.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">
                              {new Date(bill.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <span className={`px-2 py-1 text-xs rounded-full ₱{
                              bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                              bill.status === 'overdue' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {bill.status}
                            </span>
                          </div>
                          <p className="font-semibold">₱{bill.amount.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payments */}
                {roomDetails.payments.length > 0 && (
                  <div>
                    <h5 className="text-md font-medium text-gray-900 mb-3">Payments</h5>
                    <div className="space-y-2">
                      {roomDetails.payments.map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">
                              {new Date(payment.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <span className="text-sm text-gray-500">{payment.method}</span>
                          </div>
                          <p className="font-semibold">₱{payment.amount_paid.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {roomDetails.bills.length === 0 && roomDetails.payments.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No billing or payment records for this room.
                  </div>
                )}
              </div>
            )}

            {!roomDetails.tenant && (
              <div className="mt-8 text-center py-8 text-gray-500">
                This room is currently available.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full max-w-[calc(100%-1rem)] sm:max-w-md mx-2 sm:mx-4 my-2 sm:my-4 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {editingRoom ? 'Edit Room' : 'Add Room'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Room Number</label>
                <input
                  type="text"
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Type</label>
                <input
                  type="text"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Rent Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rent_amount}
                  onChange={(e) => setFormData({ ...formData, rent_amount: e.target.value })}
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
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Maintenance</option>
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
                    setEditingRoom(null)
                    setFormData({
                      room_number: '',
                      type: '',
                      rent_amount: '',
                      status: 'available',
                      description: '',
                      electric_meter_number: '',
                      initial_electric_reading: '',
                      electric_included: false,
                      max_occupancy: '1',
                      deposit_amount: '',
                    })
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingRoom ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
