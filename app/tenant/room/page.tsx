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
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-3xl font-bold text-white mb-2">{room.room_number}</h3>
                <p className="text-blue-100 text-lg">{room.type}</p>
              </div>
              <span className={`px-4 py-2 text-sm font-semibold rounded-full ${
                room.status === 'available'
                  ? 'bg-green-100 text-green-800'
                  : room.status === 'occupied'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {room.status}
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Room Information */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Room Details</h4>
                  
                  {room.description && (
                    <div className="mb-6">
                      <p className="text-gray-600 leading-relaxed">{room.description}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Rent Amount:</span>
                      <span className="text-xl font-bold text-gray-900">₱{room.rent_amount.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Deposit Amount:</span>
                      <span className="font-semibold text-gray-900">₱{room.deposit_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Max Occupancy:</span>
                      <span className="font-semibold text-gray-900">{room.max_occupancy || 1} person(s)</span>
                    </div>
                  </div>

                  {/* Amenities */}
                  <div className="mt-6">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3">Included Amenities</h5>
                    <div className="flex flex-wrap gap-2">
                      {room.wifi_included && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          WiFi Included
                        </span>
                      )}
                      {room.water_included && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          Water Included
                        </span>
                      )}
                      {room.electric_included && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          Electricity Included
                        </span>
                      )}
                      {!room.wifi_included && !room.water_included && !room.electric_included && (
                        <p className="text-gray-500 text-sm">No additional amenities included</p>
                      )}
                    </div>
                  </div>

                  {/* Meter Numbers */}
                  {(room.electric_meter_number || room.water_meter_number) && (
                    <div className="mt-6">
                      <h5 className="text-sm font-semibold text-gray-700 mb-3">Meter Numbers</h5>
                      <div className="space-y-2">
                        {room.electric_meter_number && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Electric:</span>
                            <span className="font-medium">{room.electric_meter_number}</span>
                          </div>
                        )}
                        {room.water_meter_number && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Water:</span>
                            <span className="font-medium">{room.water_meter_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tenant Information */}
              {tenant && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Lease Information</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Start Date</p>
                      <p className="font-semibold">
                        {new Date(tenant.start_date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Emergency Contact</p>
                      <p className="font-semibold">{tenant.emergency_contact_name}</p>
                      <p className="font-semibold">{tenant.emergency_contact_number}</p>
                    </div>
                  </div>

                  {/* Quick Actions or Additional Info */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3">Quick Information</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Room Status</p>
                        <p className="font-semibold text-gray-900">{room.status}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Tenant Since</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(tenant.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-lg text-gray-500 mb-2">You are not assigned to any room</p>
            <p className="text-sm text-gray-400">Please contact the administrator for room assignment</p>
          </div>
        </div>
      )}
    </div>
  )
}
