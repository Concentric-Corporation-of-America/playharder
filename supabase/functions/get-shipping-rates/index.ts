import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import type { Address, Package, ShippingRate, ShipmentRequest, ShippoAddress, ShippoParcel } from "../_shared/types.ts"

const SHIPPO_API_KEY = Deno.env.get('SHIPPO_API_KEY') || Deno.env.get('VITE_SHIPPO_API_KEY')
const SHIPPO_API_URL = 'https://api.goshippo.com'

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

    let rates: ShippingRate[]

    if (SHIPPO_API_KEY) {
      try {
        rates = await getShippoRates(request)
      } catch (error) {
        console.error('Shippo error, falling back to mock rates:', error)
        rates = getMockRates(request)
      }
    } else {
      console.log('No Shippo API key, using mock rates')
      rates = getMockRates(request)
    }

    return new Response(
      JSON.stringify({ rates }),
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
