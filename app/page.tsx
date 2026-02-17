'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '../types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [role, setRole] = useState<'admin' | 'tenant'>('tenant')

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.session.user.id)
          .single()
        setUser(userData)
      }
      setLoading(false)
    }
    checkSession()
  }, [])

  useEffect(() => {
    if (user) {
      router.push(user.role === 'admin' ? '/admin' : '/tenant')
    }
  }, [user, router])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) {
          console.error('Signup error:', error)
          if (error.message.includes('Signups not allowed')) {
            alert('Signups are disabled. Please contact an administrator.')
          } else {
            alert('Signup failed: ' + error.message)
          }
          return
        }

        if (data.user) {
          const { error: dbError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email,
              role,
            })
          if (dbError) {
            console.error('Database error:', dbError)
            alert('Failed to create user profile: ' + dbError.message)
            return
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          console.error('Login error:', error)
          alert('Login failed: ' + error.message)
          return
        }

        if (data.user) {
          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single()
            
          if (fetchError) {
            console.error('User profile error:', fetchError)
            alert('Failed to fetch user profile: ' + fetchError.message)
            return
          }
          
          setUser(userData)
        }
      }
    } catch (error) {
      console.error('Auth error:', error)
      alert('Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h2>
        
        {!isSignUp && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Quick login:</div>
            <div className="grid grid-cols-1 gap-2">
               <button
                onClick={async () => {
                  setLoading(true)
                  try {
                    // Try to sign in directly first
                    const { data, error } = await supabase.auth.signInWithPassword({
                      email: 'admin@example.com',
                      password: 'admin123',
                    })

                    if (error) {
                      console.error('Login error:', error)
                      if (error.message.includes('Invalid login credentials')) {
                        alert('Admin account does not exist. Please create an admin account first in Supabase dashboard.')
                      } else {
                        alert('Login failed: ' + error.message)
                      }
                      return
                    }

                    if (data.user) {
                      const { data: userData, error: fetchError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .single()
                        
                      if (fetchError) {
                        console.error('User profile error:', fetchError)
                        alert('Failed to fetch user profile: ' + fetchError.message)
                        return
                      }
                      
                      setUser(userData)
                    }
                  } catch (error) {
                    console.error('Admin login error:', error)
                    alert('Failed to login as admin: ' + (error as Error).message)
                  } finally {
                    setLoading(false)
                  }
                }}
                className="text-left px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                Admin: admin@example.com / admin123
              </button>
              <button
                onClick={async () => {
                  setLoading(true)
                  try {
                    // Try to sign in directly first
                    const { data, error } = await supabase.auth.signInWithPassword({
                      email: 'tenant@example.com',
                      password: 'tenant123',
                    })

                    if (error) {
                      console.error('Login error:', error)
                      if (error.message.includes('Invalid login credentials')) {
                        alert('Tenant account does not exist. Please create a tenant account first in Supabase dashboard.')
                      } else {
                        alert('Login failed: ' + error.message)
                      }
                      return
                    }

                    if (data.user) {
                      const { data: userData, error: fetchError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .single()
                        
                      if (fetchError) {
                        console.error('User profile error:', fetchError)
                        alert('Failed to fetch user profile: ' + fetchError.message)
                        return
                      }
                      
                      setUser(userData)
                    }
                  } catch (error) {
                    console.error('Tenant login error:', error)
                    alert('Failed to login as tenant: ' + (error as Error).message)
                  } finally {
                    setLoading(false)
                  }
                }}
                className="text-left px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                Tenant: tenant@example.com / tenant123
              </button>
            </div>
            <div className="h-px bg-gray-200 my-4"></div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          {isSignUp && (
            <div>
              <label className="label">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'tenant')}
                className="input-field"
              >
                <option value="tenant">Tenant</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
           <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>
        <div className="text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  )
}
