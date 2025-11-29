import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Google Maps types - these are available when the script loads
interface GoogleMapsAPI {
  maps: {
    places: {
      Autocomplete: new (input: HTMLInputElement, options: object) => GoogleAutocomplete
    }
    event: {
      clearInstanceListeners: (instance: unknown) => void
    }
  }
}

interface WindowWithGoogle extends Window {
  google?: GoogleMapsAPI
}

interface GooglePlaceResult {
  address_components?: Array<{
    long_name: string
    short_name: string
    types: string[]
  }>
  formatted_address?: string
  geometry?: {
    location?: {
      lat: () => number
      lng: () => number
    }
  }
  place_id?: string
}

interface GoogleAutocomplete {
  addListener: (event: string, callback: () => void) => void
  getPlace: () => GooglePlaceResult
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string, placeDetails?: GooglePlaceResult) => void
  placeholder?: string
  className?: string
  label?: string
  disabled?: boolean
}

export interface ParsedAddress {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  formattedAddress: string
  lat?: number
  lng?: number
}

interface AddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

// Parse Google Place result into structured address
export function parseGooglePlace(place: GooglePlaceResult): ParsedAddress {
  const components = place.address_components || []
  
  const getComponent = (type: string): string => {
    const component = components.find((c: AddressComponent) => c.types.includes(type))
    return component?.long_name || ''
  }
  
  const getShortComponent = (type: string): string => {
    const component = components.find((c: AddressComponent) => c.types.includes(type))
    return component?.short_name || ''
  }

  const streetNumber = getComponent('street_number')
  const route = getComponent('route')
  const street = streetNumber ? `${streetNumber} ${route}` : route

  return {
    street,
    city: getComponent('locality') || getComponent('sublocality') || getComponent('administrative_area_level_2'),
    state: getShortComponent('administrative_area_level_1'),
    postalCode: getComponent('postal_code'),
    country: getShortComponent('country'),
    formattedAddress: place.formatted_address || '',
    lat: place.geometry?.location?.lat(),
    lng: place.geometry?.location?.lng()
  }
}

// Load Google Maps script dynamically
let googleMapsPromise: Promise<void> | null = null

function loadGoogleMaps(): Promise<void> {
  if (googleMapsPromise) return googleMapsPromise
  
  if ((window as WindowWithGoogle).google?.maps?.places) {
    return Promise.resolve()
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    
    if (!apiKey) {
      console.warn('Google Maps API key not configured. Address autocomplete will be disabled.')
      reject(new Error('Google Maps API key not configured'))
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    
    document.head.appendChild(script)
  })

  return googleMapsPromise
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Enter address',
  className,
  label,
  disabled = false
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  // Sync external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Initialize Google Maps autocomplete
  useEffect(() => {
    let mounted = true

    loadGoogleMaps()
      .then(() => {
        if (!mounted) return
        setIsGoogleLoaded(true)
        setIsLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  // Set up autocomplete when Google Maps is loaded
  useEffect(() => {
    if (!isGoogleLoaded || !inputRef.current || autocompleteRef.current) return

    // Access Google Maps from window object
    const googleMaps = (window as WindowWithGoogle).google?.maps
    if (!googleMaps?.places) return

    const autocomplete = new googleMaps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
      types: ['address']
    }) as GoogleAutocomplete

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      
      if (place.formatted_address) {
        setInputValue(place.formatted_address)
        onChange(place.formatted_address, place)
      }
    })

    autocompleteRef.current = autocomplete

    return () => {
      if (autocompleteRef.current && googleMaps?.event) {
        googleMaps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [isGoogleLoaded, onChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
  }, [onChange])

  return (
    <div className="relative">
      {label && (
        <label className="flex items-center gap-2 text-cosmic-cyan font-medium mb-2">
          <MapPin className="w-4 h-4" />
          {label}
        </label>
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            'bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 focus:border-cosmic-cyan pr-10',
            className
          )}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-cosmic-cyan animate-spin" />
          </div>
        )}
        {!isLoading && isGoogleLoaded && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <MapPin className="w-4 h-4 text-cosmic-cyan opacity-50" />
          </div>
        )}
      </div>
      {!isGoogleLoaded && !isLoading && (
        <p className="text-xs text-gray-500 mt-1">
          Address autocomplete unavailable. Please enter address manually.
        </p>
      )}
    </div>
  )
}
