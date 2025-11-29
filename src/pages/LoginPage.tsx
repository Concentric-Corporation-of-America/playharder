import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match')
          setIsLoading(false)
          return
        }

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        })

        if (error) throw error
        toast.success('Check your email for the verification link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })

        if (error) throw error
        toast.success('Welcome back, space traveler!')
        navigate('/dashboard')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      })
      if (error) throw error
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      toast.error(errorMessage)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background stars effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-full opacity-50 animate-pulse" />
        <div className="absolute top-40 right-20 w-1 h-1 bg-white rounded-full opacity-30 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-60 left-1/4 w-1.5 h-1.5 bg-cosmic-cyan rounded-full opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 right-1/3 w-2 h-2 bg-cosmic-pink rounded-full opacity-30 animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute bottom-20 left-1/3 w-1 h-1 bg-white rounded-full opacity-50 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-4">
            <Rocket className="w-5 h-5 text-cosmic-cyan" />
            <span className="text-cosmic-cyan font-medium tracking-wider">PLAYHARDER</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isSignUp ? 'Join the Mission' : 'Welcome Back'}
          </h1>
          <p className="text-gray-400">
            {isSignUp ? 'Create your account to start shipping' : 'Sign in to track your shipments'}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-cosmic-cyan font-medium text-sm">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <Input
              type="email"
              placeholder="astronaut@cosmic.golf"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 focus:border-cosmic-cyan"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-cosmic-cyan font-medium text-sm">
              <Lock className="w-4 h-4" />
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 focus:border-cosmic-cyan pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Sign Up only) */}
          {isSignUp && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-cosmic-cyan font-medium text-sm">
                <Lock className="w-4 h-4" />
                Confirm Password
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 focus:border-cosmic-cyan"
                required
              />
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit"
            disabled={isLoading}
            className="w-full cosmic-button text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                {isSignUp ? 'Launch Account' : 'Enter Orbit'}
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-gray-500">or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthLogin('google')}
              className="bg-transparent border-cosmic-purple/30 text-white hover:bg-cosmic-purple/20"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthLogin('github')}
              className="bg-transparent border-cosmic-purple/30 text-white hover:bg-cosmic-purple/20"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </Button>
          </div>

          {/* Toggle Sign Up / Sign In */}
          <p className="text-center text-gray-400 text-sm">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-cosmic-cyan hover:text-cosmic-pink transition-colors"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </form>

        {/* Back to Home */}
        <p className="text-center mt-6">
          <a href="/" className="text-gray-500 hover:text-cosmic-cyan transition-colors text-sm">
            &larr; Back to Home
          </a>
        </p>
      </div>
    </div>
  )
}
