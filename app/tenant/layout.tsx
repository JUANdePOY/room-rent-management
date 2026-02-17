'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { User } from '../../types'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import ChangePasswordModal from '../components/ChangePasswordModal'

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single()

      if (!userData || userData.role !== 'tenant') {
        router.push('/')
        return
      }

      setUser(userData)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  const getPageTitle = () => {
    if (pathname === '/tenant') return 'My Dashboard'
    if (pathname.includes('/room')) return 'My Room'
    if (pathname.includes('/bills')) return 'My Bills'
    if (pathname.includes('/payments')) return 'My Payments'
    return 'My Dashboard'
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-200 to-gray-300">
      {/* Desktop Layout */}
      <div className="hidden md:flex">
        <aside 
          className={`bg-gray-200 shadow-lg min-h-screen transition-all duration-300 ease-in-out flex flex-col ${
            sidebarOpen ? 'w-64' : 'w-16'
          }`}
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => setSidebarOpen(false)}
        >
          {/* Logo Container */}
          <div className="p-4 border-b border-gray-200">
            <div className={`flex items-center ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
              <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">RR</span>
              </div>
              {sidebarOpen && (
                <span className="ml-3 text-lg font-bold text-gray-800">RoomRent</span>
              )}
            </div>
          </div>

          <nav className="p-4 space-y-2 flex-1">
            <Link
              href="/tenant"
              className={`block px-4 py-2 text-gray-800 rounded-lg hover:bg-gray-100 transition-all ₱{
                sidebarOpen ? 'text-left' : 'justify-center'
              }`}
            >
              <div className={`flex items-center ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {sidebarOpen && <span className="ml-3">Dashboard</span>}
              </div>
            </Link>
            <Link
              href="/tenant/room"
              className={`block px-4 py-2 text-gray-800 rounded-lg hover:bg-gray-100 transition-all ₱{
                sidebarOpen ? 'text-left' : 'justify-center'
              }`}
            >
              <div className={`flex items-center ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {sidebarOpen && <span className="ml-3">My Room</span>}
              </div>
            </Link>
            <Link
              href="/tenant/bills"
              className={`block px-4 py-2 text-gray-800 rounded-lg hover:bg-gray-100 transition-all ₱{
                sidebarOpen ? 'text-left' : 'justify-center'
              }`}
            >
              <div className={`flex items-center ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {sidebarOpen && <span className="ml-3">My Bills</span>}
              </div>
            </Link>
            <Link
              href="/tenant/payments"
              className={`block px-4 py-2 text-gray-800 rounded-lg hover:bg-gray-100 transition-all ₱{
                sidebarOpen ? 'text-left' : 'justify-center'
              }`}
            >
              <div className={`flex items-center ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {sidebarOpen && <span className="ml-3">My Payments</span>}
              </div>
            </Link>
          </nav>

          {/* Sign Out Button at Footer */}
          <div className="p-4 border-t border-gray-200 mt-auto">
            <button
              onClick={handleSignOut}
              className={`w-full flex items-center justify-center px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100 transition-all ₱{
                sidebarOpen ? 'justify-start' : 'justify-center'
              }`}
            >
              {sidebarOpen ? (
                <>
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col p-4 md:p-6">
          <div className="flex-1 bg-white rounded-2xl shadow-lg p-6 md:p-8">
            <header className="mb-8">
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <button 
                      onClick={() => setProfileOpen(!profileOpen)}
                      className="flex items-center space-x-3 focus:outline-none"
                    >
                      <span className="text-gray-700">Welcome, {user?.email}</span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Tenant
                      </span>
                      <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {user?.email?.charAt(0).toUpperCase() || 'T'}
                        </span>
                      </div>
                    </button>
                    
                    {/* Profile Dropdown */}
                    {profileOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                        <div className="p-4 border-b border-gray-200">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {user?.email?.charAt(0).toUpperCase() || 'T'}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 text-sm">{user?.email}</p>
                              <p className="text-xs text-gray-500">Tenant</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-2">
                          <button
                            onClick={() => {
                              setChangePasswordModalOpen(true)
                              setProfileOpen(false)
                            }}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span>Change Password</span>
                          </button>
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main>
              {children}
            </main>
          </div>
        </div>
      </div>

        {/* Mobile Layout */}
      <div className="md:hidden flex flex-col h-screen">
        <div className="flex-1 p-4 overflow-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <header className="mb-8">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
                <div className="relative">
                  <button 
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center space-x-3 focus:outline-none"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-xs">
                        {user?.email?.charAt(0).toUpperCase() || 'T'}
                      </span>
                    </div>
                  </button>
                  
                  {/* Profile Dropdown */}
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {user?.email?.charAt(0).toUpperCase() || 'T'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-sm">{user?.email}</p>
                            <p className="text-xs text-gray-500">Tenant</p>
                          </div>
                        </div>
                      </div>
                       <div className="p-2">
                         <button
                           onClick={() => {
                             setChangePasswordModalOpen(true)
                             setProfileOpen(false)
                           }}
                           className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                           </svg>
                           <span>Change Password</span>
                         </button>
                         <button
                           onClick={handleSignOut}
                           className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                           </svg>
                           <span>Sign Out</span>
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <main>
              {children}
            </main>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white border-t border-gray-200 shadow-lg">
          <nav className="flex justify-around items-center h-16">
            <Link
              href="/tenant"
              className={`flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-green-600 transition-colors ₱{
                pathname === '/tenant' ? 'text-green-600' : ''
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs">Home</span>
            </Link>
            <Link
              href="/tenant/room"
              className={`flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-green-600 transition-colors ₱{
                pathname.includes('/room') ? 'text-green-600' : ''
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-xs">Room</span>
            </Link>
            <Link
              href="/tenant/bills"
              className={`flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-green-600 transition-colors ₱{
                pathname.includes('/bills') ? 'text-green-600' : ''
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">Bills</span>
            </Link>
            <Link
              href="/tenant/payments"
              className={`flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-green-600 transition-colors ₱{
                pathname.includes('/payments') ? 'text-green-600' : ''
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-xs">Payments</span>
            </Link>
          </nav>
        </div>
      </div>
      
      <ChangePasswordModal 
        isOpen={changePasswordModalOpen} 
        onClose={() => setChangePasswordModalOpen(false)} 
      />
    </div>
  )
}
