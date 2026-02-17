'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tenant, Room } from '../../../types'

export default function TenantRoomPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
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

      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', tenantData.room_id)
        .single()

      if (roomData) setRoom(roomData)
    }

    setLoading(false)
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
      <h2 className="text-2xl font-bold text-gray-900">My Room</h2>

      {room ? (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{room.room_number}</h3>
                <p className="text-gray-600 mb-4">{room.description}</p>

                <div className="space-y-2">
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
                </div>
              </div>
            </div>

            {tenant && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Lease Information</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium">{new Date(tenant.start_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emergency Contact:</span>
                    <span className="font-medium">{tenant.emergency_contact_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emergency Contact Number:</span>
                    <span className="font-medium">{tenant.emergency_contact_number}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="text-center text-gray-500 py-8">You are not assigned to any room</p>
        </div>
      )}
    </div>
  )
}
