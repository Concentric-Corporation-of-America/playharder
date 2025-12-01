import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { MapPin, Loader2, CheckCircle, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GoogleMapsAPI {
  maps: {
    places: {
      Autocomplete: new (input: HTMLInputElement, options: object) => GoogleAutocomplete
      AutocompleteService: new () => GoogleAutocompleteService
      PlacesService: new (attrContainer: HTMLDivElement) => GooglePlacesService
    }
    event: {
      clearInstanceListeners: (instance: unknown) => void
    }
  }
}

interface WindowWithGoogle extends Window {
  google?: GoogleMapsAPI
}

interface AutocompletePrediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
  types: string[]
}

interface GoogleAutocompleteService {
  getPlacePredictions: (
    request: { input: string; types?: string[]; componentRestrictions?: { country: string } },
    callback: (predictions: AutocompletePrediction[] | null, status: string) => void
  ) => void
}

interface GooglePlacesService {
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (place: GooglePlaceResult | null, status: string) => void
  ) => void
}

export interface GooglePlaceResult {
  address_components?: Array<{
    long_name: string
    short_name: string
    types: string[]
  }>
  formatted_address?: string
  name?: string
  types?: string[]
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
  mode?: 'golf' | 'generic'
}

function isGolfRelated(prediction: AutocompletePrediction): boolean {
  const golfTypes = ['golf_course', 'country_club', 'sports_complex']
  const hasGolfType = prediction.types?.some(t => golfTypes.includes(t))
  const namePattern = /golf|country club|club house|clubhouse|links|fairway/i
  const hasGolfName = namePattern.test(prediction.structured_formatting.main_text) || 
                      namePattern.test(prediction.description)
  return hasGolfType || hasGolfName
}

function sortPredictions(predictions: AutocompletePrediction[]): AutocompletePrediction[] {
  return [...predictions].sort((a, b) => {
    const aIsGolf = isGolfRelated(a)
    const bIsGolf = isGolfRelated(b)
    if (aIsGolf && !bIsGolf) return -1
    if (!aIsGolf && bIsGolf) return 1
    return 0
  })
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
  disabled = false,
  mode = 'golf'
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const autocompleteServiceRef = useRef<GoogleAutocompleteService | null>(null)
  const placesServiceRef = useRef<GooglePlacesService | null>(null)
  const placesContainerRef = useRef<HTMLDivElement | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isVerified, setIsVerified] = useState(false)
  const [verifiedName, setVerifiedName] = useState<string | null>(null)

  useEffect(() => {
    setInputValue(value)
    if (!value) {
      setIsVerified(false)
      setVerifiedName(null)
    }
  }, [value])

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

  useEffect(() => {
    if (!isGoogleLoaded) return

    const googleMaps = (window as WindowWithGoogle).google?.maps
    if (!googleMaps?.places) return

    autocompleteServiceRef.current = new googleMaps.places.AutocompleteService()
    
    if (!placesContainerRef.current) {
      placesContainerRef.current = document.createElement('div')
    }
    placesServiceRef.current = new googleMaps.places.PlacesService(placesContainerRef.current)
  }, [isGoogleLoaded])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteServiceRef.current || input.length < 2) {
      setPredictions([])
      return
    }

    const request = {
      input,
      componentRestrictions: { country: 'us' },
      types: mode === 'golf' ? ['establishment'] : ['address']
    }

    autocompleteServiceRef.current.getPlacePredictions(request, (results, status) => {
      if (status === 'OK' && results) {
        const sorted = mode === 'golf' ? sortPredictions(results) : results
        setPredictions(sorted.slice(0, 6))
        setShowDropdown(true)
      } else {
        setPredictions([])
      }
    })
  }, [mode])

  const selectPrediction = useCallback((prediction: AutocompletePrediction) => {
    if (!placesServiceRef.current) return

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id', 'name', 'types']
      },
      (place, status) => {
        if (status === 'OK' && place) {
          setInputValue(place.formatted_address || prediction.description)
          setIsVerified(true)
          setVerifiedName(place.name || prediction.structured_formatting.main_text)
          setShowDropdown(false)
          setPredictions([])
          onChange(place.formatted_address || prediction.description, place)
        }
      }
    )
  }, [onChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setIsVerified(false)
    setVerifiedName(null)
    setSelectedIndex(-1)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(newValue)
    }, 250)

    onChange(newValue)
  }, [onChange, fetchPredictions])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < predictions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : predictions.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          selectPrediction(predictions[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        break
    }
  }, [showDropdown, predictions, selectedIndex, selectPrediction])

  const golfPlaceholder = mode === 'golf' 
    ? 'Country club, golf course, or address...' 
    : placeholder

  return (
    <div className="relative">
      {label && (
        <label className="flex items-center gap-2 text-cosmic-cyan font-medium mb-2">
          {mode === 'golf' ? <Flag className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          {label}
        </label>
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 2 && predictions.length > 0 && setShowDropdown(true)}
          placeholder={golfPlaceholder}
          disabled={disabled || isLoading}
          className={cn(
            'bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 focus:border-cosmic-cyan pr-10',
            isVerified && 'border-green-500/50',
            className
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-cosmic-cyan animate-spin" />
          ) : isVerified ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : isGoogleLoaded ? (
            <MapPin className="w-4 h-4 text-cosmic-cyan opacity-50" />
          ) : null}
        </div>
      </div>

      {isVerified && verifiedName && (
        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {verifiedName} - Verified by Google
        </p>
      )}

      {showDropdown && predictions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-cosmic-darker border border-cosmic-purple/30 rounded-lg shadow-xl overflow-hidden"
        >
          {predictions.map((prediction, index) => {
            const isGolf = isGolfRelated(prediction)
            return (
              <button
                key={prediction.place_id}
                type="button"
                onClick={() => selectPrediction(prediction)}
                className={cn(
                  'w-full px-4 py-3 text-left transition-colors flex items-start gap-3',
                  index === selectedIndex 
                    ? 'bg-cosmic-purple/30' 
                    : 'hover:bg-cosmic-purple/20',
                  index !== predictions.length - 1 && 'border-b border-cosmic-purple/20'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isGolf ? (
                    <Flag className="w-4 h-4 text-green-400" />
                  ) : (
                    <MapPin className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    'font-medium truncate',
                    isGolf ? 'text-green-400' : 'text-white'
                  )}>
                    {prediction.structured_formatting.main_text}
                  </div>
                  <div className="text-sm text-gray-400 truncate">
                    {prediction.structured_formatting.secondary_text}
                  </div>
                  {isGolf && (
                    <span className="inline-block mt-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                      Golf Course
                    </span>
                  )}
                </div>
              </button>
            )
          })}
          <div className="px-4 py-2 text-xs text-gray-500 bg-cosmic-darker/50 border-t border-cosmic-purple/20">
            Powered by Google
          </div>
        </div>
      )}

      {!isGoogleLoaded && !isLoading && (
        <p className="text-xs text-gray-500 mt-1">
          Address autocomplete unavailable. Please enter address manually.
        </p>
      )}
    </div>
  )
}
