import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, Package, Truck, MapPin, Clock, LogOut, User, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Order {
  id: string
  tracking_number: string
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered'
  pickup_location: string
  dropoff_location: string
  weight_range: string
  tee_time: string
  created_at: string
  carrier: string
}

const mockOrders: Order[] = [
  {
    id: '1',
    tracking_number: 'CGD-2025-001',
    status: 'in_transit',
    pickup_location: 'Los Angeles, CA',
    dropoff_location: 'Pebble Beach Golf Links',
    weight_range: 'Medium (15-30 lbs)',
    tee_time: '2025-01-15T08:00:00',
    created_at: '2025-01-10T14:30:00',
    carrier: 'FedEx'
  },
  {
    id: '2',
    tracking_number: 'CGD-2025-002',
    status: 'delivered',
    pickup_location: 'Miami, FL',
    dropoff_location: 'TPC Sawgrass',
    weight_range: 'Heavy (30-50 lbs)',
    tee_time: '2025-01-12T10:30:00',
    created_at: '2025-01-08T09:15:00',
    carrier: 'UPS'
  },
  {
    id: '3',
    tracking_number: 'CGD-2025-003',
    status: 'pending',
    pickup_location: 'New York, NY',
    dropoff_location: 'Augusta National Golf Club',
    weight_range: 'Light (0-15 lbs)',
    tee_time: '2025-01-20T07:00:00',
    created_at: '2025-01-14T16:45:00',
    carrier: 'USPS'
  }
]

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  picked_up: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_transit: 'bg-cosmic-purple/20 text-cosmic-purple border-cosmic-purple/30',
  out_for_delivery: 'bg-cosmic-cyan/20 text-cosmic-cyan border-cosmic-cyan/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30'
}

const statusLabels = {
  pending: 'Pending Pickup',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [orders] = useState<Order[]>(mockOrders)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)
    } catch (error) {
      console.error('Error checking user:', error)
      navigate('/login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Logged out successfully')
      navigate('/login')
    } catch (error) {
      console.error('Error logging out:', error)
      toast.error('Failed to log out')
    }
  }

  const handleRefresh = () => {
    toast.success('Orders refreshed')
  }

  const filteredOrders = orders.filter(order => 
    order.tracking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.pickup_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.dropoff_location.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cosmic-cyan/30 border-t-cosmic-cyan rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-card border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cosmic-dark">
              <Rocket className="w-5 h-5 text-cosmic-cyan" />
              <span className="text-cosmic-cyan font-bold tracking-wider">PLAYHARDER</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <User className="w-4 h-4" />
              <span className="text-sm">{user?.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-400 hover:text-white hover:bg-cosmic-purple/20"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Order Tracking</h1>
          <p className="text-gray-400">Track your cosmic golf gear shipments across the universe</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cosmic-cyan/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-cosmic-cyan" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Orders</p>
                <p className="text-2xl font-bold text-white">{orders.length}</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cosmic-purple/20 flex items-center justify-center">
                <Truck className="w-5 h-5 text-cosmic-purple" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">In Transit</p>
                <p className="text-2xl font-bold text-white">
                  {orders.filter(o => o.status === 'in_transit').length}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Pending</p>
                <p className="text-2xl font-bold text-white">
                  {orders.filter(o => o.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Delivered</p>
                <p className="text-2xl font-bold text-white">
                  {orders.filter(o => o.status === 'delivered').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by tracking number or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 focus:border-cosmic-cyan"
            />
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="bg-transparent border-cosmic-purple/30 text-white hover:bg-cosmic-purple/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No orders found</h3>
              <p className="text-gray-400">
                {searchQuery ? 'Try a different search term' : 'Your shipments will appear here'}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="glass-card rounded-xl p-6 hover:border-cosmic-cyan/30 transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-cosmic-cyan font-mono font-bold">{order.tracking_number}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                      <span className="px-2 py-1 rounded bg-cosmic-dark text-gray-400 text-xs">
                        {order.carrier}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-cosmic-pink mt-0.5" />
                        <div>
                          <p className="text-gray-500">From</p>
                          <p className="text-white">{order.pickup_location}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-cosmic-cyan mt-0.5" />
                        <div>
                          <p className="text-gray-500">To</p>
                          <p className="text-white">{order.dropoff_location}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="flex flex-col items-end gap-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>Tee Time: {new Date(order.tee_time).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                    <div className="text-gray-500">
                      Weight: {order.weight_range}
                    </div>
                    <Button
                      size="sm"
                      className="cosmic-button text-white text-xs"
                    >
                      Track Details
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex justify-between mb-2">
                    {['Pending', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'].map((step, index) => {
                      const statusIndex = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'].indexOf(order.status)
                      const isActive = index <= statusIndex
                      return (
                        <div key={step} className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-cosmic-cyan' : 'bg-gray-700'}`} />
                          <span className={`text-xs mt-1 hidden md:block ${isActive ? 'text-cosmic-cyan' : 'text-gray-600'}`}>
                            {step}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cosmic-cyan to-cosmic-pink transition-all duration-500"
                      style={{ 
                        width: `${(['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'].indexOf(order.status) + 1) * 20}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
