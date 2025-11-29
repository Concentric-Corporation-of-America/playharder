import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import type { Address, Package, ShippingRate, ShipmentRequest, ShippoAddress, ShippoParcel } from "../_shared/types.ts"

const SHIPPO_API_KEY = Deno.env.get('SHIPPO_API_KEY') || Deno.env.get('VITE_SHIPPO_API_KEY')
const SHIPPO_API_URL = 'https://api.goshippo.com'

// FedEx API Configuration
const FEDEX_API_KEY = Deno.env.get('FEDEX_API_KEY')
const FEDEX_SECRET_KEY = Deno.env.get('FEDEX_SECRET_KEY')
const FEDEX_API_URL = Deno.env.get('FEDEX_API_URL') || 'https://apis-sandbox.fedex.com' // Use sandbox by default

function convertToShippoAddress(address: Address): ShippoAddress {
  return {
    name: address.contactName || 'Customer',
    street1: address.street,
    city: address.city,
    state: address.state,
    zip: address.postalCode,
    country: address.country || 'US',
    phone: address.contactPhone,
    email: address.contactEmail,
  }
}

function convertToShippoParcel(pkg: Package): ShippoParcel {
  return {
    length: String(pkg.length),
    width: String(pkg.width),
    height: String(pkg.height),
    distance_unit: 'in',
    weight: String(pkg.weight),
    mass_unit: 'lb',
  }
}

interface ShippoRate {
  object_id: string
  provider: string
  servicelevel: {
    name: string
    token: string
  }
  amount: string
  currency: string
  estimated_days: number
  arrives_by?: string
}

async function getShippoRates(request: ShipmentRequest): Promise<ShippingRate[]> {
  const addressFrom = convertToShippoAddress(request.origin)
  const addressTo = convertToShippoAddress(request.destination)
  const parcels = request.packages.map(convertToShippoParcel)

  // Create shipment to get rates
  const shipmentResponse = await fetch(`${SHIPPO_API_URL}/shipments`, {
    method: 'POST',
    headers: {
      'Authorization': `ShippoToken ${SHIPPO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address_from: addressFrom,
      address_to: addressTo,
      parcels: parcels,
      async: false,
    }),
  })

  if (!shipmentResponse.ok) {
    const errorText = await shipmentResponse.text()
    console.error('Shippo API error:', errorText)
    throw new Error(`Shippo API error: ${shipmentResponse.status}`)
  }

  const shipmentData = await shipmentResponse.json()
  
  // Map Shippo rates to our format
  const rates: ShippingRate[] = shipmentData.rates.map((rate: ShippoRate, index: number) => {
    const carrierCode = rate.provider.toLowerCase()
    return {
      id: `${carrierCode}-${index}`,
      carrier: rate.provider,
      carrierCode: carrierCode,
      serviceName: rate.servicelevel.name,
      serviceType: rate.servicelevel.token,
      rate: parseFloat(rate.amount),
      currency: rate.currency,
      estimatedDays: rate.estimated_days || 5,
      deliveryDate: rate.arrives_by || getDeliveryDate(rate.estimated_days || 5),
      objectId: rate.object_id, // Store for creating shipment later
    }
  })

  return rates.sort((a, b) => a.rate - b.rate)
}

function getDeliveryDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// FedEx OAuth Token Cache
let fedexAccessToken: string | null = null
let fedexTokenExpiry: number = 0

async function getFedExAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (fedexAccessToken && Date.now() < fedexTokenExpiry - 300000) {
    return fedexAccessToken
  }

  const response = await fetch(`${FEDEX_API_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: FEDEX_API_KEY || '',
      client_secret: FEDEX_SECRET_KEY || '',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('FedEx OAuth error:', errorText)
    throw new Error(`FedEx OAuth error: ${response.status}`)
  }

  const data = await response.json()
  fedexAccessToken = data.access_token
  fedexTokenExpiry = Date.now() + (data.expires_in * 1000)
  
  return fedexAccessToken
}

interface FedExAddress {
  streetLines: string[]
  city: string
  stateOrProvinceCode: string
  postalCode: string
  countryCode: string
}

function convertToFedExAddress(address: Address): FedExAddress {
  return {
    streetLines: [address.street],
    city: address.city,
    stateOrProvinceCode: address.state,
    postalCode: address.postalCode,
    countryCode: address.country || 'US',
  }
}

interface FedExRateReply {
  rateReplyDetails: Array<{
    serviceType: string
    serviceName: string
    ratedShipmentDetails: Array<{
      totalNetCharge: number
      currency: string
    }>
    commit?: {
      dateDetail?: {
        dayOfWeek: string
        dayCxsFormat: string
      }
    }
    operationalDetail?: {
      transitTime?: string
    }
  }>
}

async function getFedExRates(request: ShipmentRequest): Promise<ShippingRate[]> {
  const accessToken = await getFedExAccessToken()
  
  const requestBody = {
    accountNumber: {
      value: Deno.env.get('FEDEX_ACCOUNT_NUMBER') || '',
    },
    requestedShipment: {
      shipper: {
        address: convertToFedExAddress(request.origin),
      },
      recipient: {
        address: convertToFedExAddress(request.destination),
      },
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      rateRequestType: ['LIST', 'ACCOUNT'],
      requestedPackageLineItems: request.packages.map(pkg => ({
        weight: {
          units: 'LB',
          value: pkg.weight,
        },
        dimensions: {
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
          units: 'IN',
        },
      })),
    },
  }

  const response = await fetch(`${FEDEX_API_URL}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('FedEx Rate API error:', errorText)
    throw new Error(`FedEx Rate API error: ${response.status}`)
  }

  const data: { output: FedExRateReply } = await response.json()
  
  if (!data.output?.rateReplyDetails) {
    return []
  }

  const rates: ShippingRate[] = data.output.rateReplyDetails.map((rate, index) => {
    const ratedDetails = rate.ratedShipmentDetails?.[0]
    const transitDays = getTransitDays(rate.operationalDetail?.transitTime)
    
    return {
      id: `fedex-${rate.serviceType}-${index}`,
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: rate.serviceName || rate.serviceType,
      serviceType: rate.serviceType,
      rate: ratedDetails?.totalNetCharge || 0,
      currency: ratedDetails?.currency || 'USD',
      estimatedDays: transitDays,
      deliveryDate: rate.commit?.dateDetail?.dayCxsFormat || getDeliveryDate(transitDays),
      source: 'fedex_direct', // Mark as direct FedEx API
    }
  })

  return rates.filter(r => r.rate > 0).sort((a, b) => a.rate - b.rate)
}

function getTransitDays(transitTime?: string): number {
  if (!transitTime) return 5
  
  const transitMap: Record<string, number> = {
    'ONE_DAY': 1,
    'TWO_DAYS': 2,
    'THREE_DAYS': 3,
    'FOUR_DAYS': 4,
    'FIVE_DAYS': 5,
    'SIX_DAYS': 6,
    'SEVEN_DAYS': 7,
  }
  
  return transitMap[transitTime] || 5
}

// Mock rates for development/testing when Shippo is unavailable
function getMockRates(request: ShipmentRequest): ShippingRate[] {
  const baseWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0)
  
  return [
    {
      id: 'fedex-ground',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx Ground',
      serviceType: 'FEDEX_GROUND',
      rate: 12.99 + (baseWeight * 0.5),
      currency: 'USD',
      estimatedDays: 5,
      deliveryDate: getDeliveryDate(5)
    },
    {
      id: 'ups-ground',
      carrier: 'UPS',
      carrierCode: 'ups',
      serviceName: 'UPS Ground',
      serviceType: '03',
      rate: 11.99 + (baseWeight * 0.45),
      currency: 'USD',
      estimatedDays: 5,
      deliveryDate: getDeliveryDate(5)
    },
    {
      id: 'usps-priority',
      carrier: 'USPS',
      carrierCode: 'usps',
      serviceName: 'USPS Priority Mail',
      serviceType: 'PRIORITY_MAIL',
      rate: 9.99 + (baseWeight * 0.35),
      currency: 'USD',
      estimatedDays: 3,
      deliveryDate: getDeliveryDate(3)
    },
  ].sort((a, b) => a.rate - b.rate)
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const request: ShipmentRequest = await req.json()

    // Validate request
    if (!request.origin || !request.destination || !request.packages?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: origin, destination, packages' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Collect rates from all available carriers in parallel
    const ratePromises: Promise<ShippingRate[]>[] = []
    
    // Try FedEx direct API first (preferred)
    if (FEDEX_API_KEY && FEDEX_SECRET_KEY) {
      ratePromises.push(
        getFedExRates(request).catch(error => {
          console.error('FedEx API error:', error)
          return [] // Return empty array on error
        })
      )
    }
    
    // Also try Shippo for other carriers (UPS, USPS, DHL)
    if (SHIPPO_API_KEY) {
      ratePromises.push(
        getShippoRates(request).catch(error => {
          console.error('Shippo API error:', error)
          return [] // Return empty array on error
        })
      )
    }

    let allRates: ShippingRate[] = []
    
    if (ratePromises.length > 0) {
      const results = await Promise.all(ratePromises)
      allRates = results.flat()
      
      // Deduplicate FedEx rates (prefer direct API over Shippo)
      const seenServices = new Set<string>()
      allRates = allRates.filter(rate => {
        // For FedEx, prefer direct API rates (marked with source: 'fedex_direct')
        const key = `${rate.carrierCode}-${rate.serviceType}`
        if (seenServices.has(key)) {
          // If we already have this service, only keep if it's from direct API
          return (rate as { source?: string }).source === 'fedex_direct'
        }
        seenServices.add(key)
        return true
      })
    }
    
    // Fall back to mock rates if no real rates available
    if (allRates.length === 0) {
      console.log('No carrier APIs available, using mock rates')
      allRates = getMockRates(request)
    }

    // Sort by price
    allRates.sort((a, b) => a.rate - b.rate)

    return new Response(
      JSON.stringify({ rates: allRates }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error getting shipping rates:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get shipping rates' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
