import { useState } from 'react'
import { Rocket, MapPin, Weight, Clock, Zap, Target, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function LandingPage() {
  const [formData, setFormData] = useState({
    pickup: '',
    dropoff: '',
    weight: '',
    teeTime: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Booking data:', formData)
    toast.success('Launch sequence initiated! Your gear is on its way to the stars.')
  }

  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* Background stars effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-full opacity-50 animate-pulse" />
          <div className="absolute top-40 right-20 w-1 h-1 bg-white rounded-full opacity-30 animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-60 left-1/4 w-1.5 h-1.5 bg-cosmic-cyan rounded-full opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-40 right-1/3 w-2 h-2 bg-cosmic-pink rounded-full opacity-30 animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute bottom-20 left-1/3 w-1 h-1 bg-white rounded-full opacity-50 animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Rocket with golf clubs illustration */}
        <div className="relative mb-8 animate-float">
          <div className="text-8xl">
            <svg viewBox="0 0 200 200" className="w-48 h-48 md:w-64 md:h-64">
              {/* Rocket body */}
              <ellipse cx="100" cy="100" rx="30" ry="60" fill="url(#rocketGradient)" />
              {/* Rocket tip */}
              <path d="M100 40 L85 70 L115 70 Z" fill="#ff1493" />
              {/* Rocket fins */}
              <path d="M70 130 L60 160 L85 140 Z" fill="#8b5cf6" />
              <path d="M130 130 L140 160 L115 140 Z" fill="#8b5cf6" />
              {/* Rocket window */}
              <circle cx="100" cy="85" r="12" fill="#00f5ff" opacity="0.8" />
              {/* Golf clubs sticking out */}
              <line x1="75" y1="80" x2="50" y2="50" stroke="#00f5ff" strokeWidth="4" strokeLinecap="round" />
              <circle cx="48" cy="48" r="6" fill="#00f5ff" />
              <line x1="125" y1="80" x2="150" y2="50" stroke="#ff1493" strokeWidth="4" strokeLinecap="round" />
              <circle cx="152" cy="48" r="6" fill="#ff1493" />
              {/* Flame */}
              <ellipse cx="100" cy="170" rx="15" ry="25" fill="url(#flameGradient)" />
              <defs>
                <linearGradient id="rocketGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1a1a3e" />
                  <stop offset="100%" stopColor="#2d2d5a" />
                </linearGradient>
                <linearGradient id="flameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ff1493" />
                  <stop offset="50%" stopColor="#ff6b35" />
                  <stop offset="100%" stopColor="#ffcc00" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
          <Rocket className="w-4 h-4 text-cosmic-cyan" />
          <span className="text-cosmic-cyan text-sm font-medium tracking-wider">COSMIC GOLF DELIVERY</span>
        </div>

        {/* Main headline */}
        <h1 className="text-center mb-4">
          <span className="block text-5xl md:text-7xl font-bold text-cosmic-cyan neon-text mb-2">
            Lost ball?
          </span>
          <span className="block text-5xl md:text-7xl font-bold text-cosmic-pink neon-pink-text">
            Fucking leave it!
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-2xl md:text-3xl text-cosmic-purple font-semibold mb-6">
          We're going to Mars...
        </p>

        {/* Description */}
        <p className="text-gray-400 text-center max-w-xl mb-8 text-lg">
          The universe's fastest golf gear delivery service. We launch your clubs into the stratosphere and land them exactly where you need them.
        </p>

        {/* CTA Button */}
        <Button 
          onClick={scrollToBooking}
          className="cosmic-button text-white font-bold py-4 px-8 rounded-full text-lg flex items-center gap-2"
        >
          <Rocket className="w-5 h-5" />
          Launch My Gear
        </Button>
      </section>

      {/* Booking Section */}
      <section id="booking" className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            Book Your Launch
          </h2>
          <p className="text-gray-400 text-center mb-10">
            Fill out the mission parameters and we'll handle the rest
          </p>

          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-6">
            {/* Pickup Location */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-cosmic-cyan font-medium">
                <MapPin className="w-4 h-4" />
                Pickup Location
              </label>
              <Input
                placeholder="Where are your clubs?"
                value={formData.pickup}
                onChange={(e) => setFormData({ ...formData, pickup: e.target.value })}
                className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 focus:border-cosmic-cyan"
              />
            </div>

            {/* Drop-off Location */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-cosmic-cyan font-medium">
                <MapPin className="w-4 h-4" />
                Drop-off Location
              </label>
              <Input
                placeholder="Where do they need to land?"
                value={formData.dropoff}
                onChange={(e) => setFormData({ ...formData, dropoff: e.target.value })}
                className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 focus:border-cosmic-cyan"
              />
            </div>

            {/* Weight Range */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-cosmic-cyan font-medium">
                <Weight className="w-4 h-4" />
                Weight Range
              </label>
              <Select onValueChange={(value) => setFormData({ ...formData, weight: value })}>
                <SelectTrigger className="bg-cosmic-darker border-cosmic-purple/30 text-white">
                  <SelectValue placeholder="Select weight range" />
                </SelectTrigger>
                <SelectContent className="bg-cosmic-dark border-cosmic-purple/30">
                  <SelectItem value="light" className="text-white hover:bg-cosmic-purple/20">Light (0-15 lbs)</SelectItem>
                  <SelectItem value="medium" className="text-white hover:bg-cosmic-purple/20">Medium (15-30 lbs)</SelectItem>
                  <SelectItem value="heavy" className="text-white hover:bg-cosmic-purple/20">Heavy (30-50 lbs)</SelectItem>
                  <SelectItem value="extra" className="text-white hover:bg-cosmic-purple/20">Extra Heavy (50+ lbs)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tee Time */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-cosmic-cyan font-medium">
                <Clock className="w-4 h-4" />
                Tee Time
              </label>
              <Input
                type="datetime-local"
                value={formData.teeTime}
                onChange={(e) => setFormData({ ...formData, teeTime: e.target.value })}
                className="bg-cosmic-darker border-cosmic-purple/30 text-white focus:border-cosmic-cyan"
              />
            </div>

            {/* Submit Button */}
            <Button 
              type="submit"
              className="w-full cosmic-button text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2"
            >
              <Rocket className="w-5 h-5" />
              Confirm Launch Sequence
            </Button>
          </form>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
            Why We're Out of This World
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 - Lightning Fast */}
            <div className="glass-card rounded-2xl p-8 text-center hover:border-cosmic-cyan/50 transition-all duration-300">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cosmic-cyan/20 to-cosmic-purple/20 flex items-center justify-center">
                <Zap className="w-10 h-10 text-cosmic-cyan" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Lightning Fast</h3>
              <p className="text-gray-400">
                From Earth to your course in record time. We don't do slow.
              </p>
            </div>

            {/* Feature 2 - Pinpoint Accuracy */}
            <div className="glass-card rounded-2xl p-8 text-center hover:border-cosmic-pink/50 transition-all duration-300">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cosmic-pink/20 to-cosmic-purple/20 flex items-center justify-center">
                <Target className="w-10 h-10 text-cosmic-pink" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Pinpoint Accuracy</h3>
              <p className="text-gray-400">
                Your clubs land exactly where they need to be. No bullshit.
              </p>
            </div>

            {/* Feature 3 - Any Weight */}
            <div className="glass-card rounded-2xl p-8 text-center hover:border-cosmic-purple/50 transition-all duration-300">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cosmic-purple/20 to-cosmic-cyan/20 flex items-center justify-center">
                <Package className="w-10 h-10 text-cosmic-purple" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Any Weight</h3>
              <p className="text-gray-400">
                Full bag? Multiple bags? We launch it all into orbit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-cosmic-purple font-medium mb-2">
            Powered by rocket fuel and bad decisions
          </p>
          <p className="text-gray-500 text-sm">
            &copy; 2025 Cosmic Golf Delivery. All rights reserved. No balls were harmed in space.
          </p>
        </div>
      </footer>
    </div>
  )
}
