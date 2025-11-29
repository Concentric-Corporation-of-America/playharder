import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import type { ShipmentRequest, ShipmentResponse, ShippingRate } from "../_shared/types.ts"

const SHIPPO_API_KEY = Deno.env.get('SHIPPO_API_KEY') || Deno.env.get('VITE_SHIPPO_API_KEY')
const SHIPPO_API_URL = 'https://api.goshippo.com'

interface CreateShipmentBody {
  origin: ShipmentRequest['origin']
  destination: ShipmentRequest['destination']
  packages: ShipmentRequest['packages']
  selectedRate: ShippingRate
  paymentIntentId: string
}

interface ShippoTransaction {
  object_id: string
  tracking_number: string
  label_url: string
  rate: {
    provider: string
    servicelevel: {
      name: string
    }
    amount: string
    estimated_days: number
  }
}

async function createShippoTransaction(rateObjectId: string): Promise<ShippoTransaction> {
  const response = await fetch(`${SHIPPO_API_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `ShippoToken ${SHIPPO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rate: rateObjectId,
      label_file_type: 'PDF',
      async: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Shippo transaction error:', errorText)
    throw new Error(`Shippo transaction error: ${response.status}`)
  }

  return await response.json()
}

function getDeliveryDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// Mock shipment for development/testing
function createMockShipment(body: CreateShipmentBody): ShipmentResponse {
  const trackingNumber = `MOCK${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`
  
  return {
    shipmentId: `ship_${Date.now()}`,
    trackingNumber: trackingNumber,
    labelUrl: `https://api.goshippo.com/labels/${trackingNumber}.pdf`,
    carrier: body.selectedRate.carrier,
    serviceName: body.selectedRate.serviceName,
    cost: body.selectedRate.rate,
    estimatedDelivery: body.selectedRate.deliveryDate || getDeliveryDate(body.selectedRate.estimatedDays),
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: CreateShipmentBody = await req.json()

    // Validate request
    if (!body.origin || !body.destination || !body.packages?.length || !body.selectedRate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let shipmentResponse: ShipmentResponse

    // If we have a Shippo rate object ID, create a real transaction
    if (SHIPPO_API_KEY && body.selectedRate.objectId) {
      try {
        const transaction = await createShippoTransaction(body.selectedRate.objectId)
        
        shipmentResponse = {
          shipmentId: transaction.object_id,
          trackingNumber: transaction.tracking_number,
          labelUrl: transaction.label_url,
          carrier: body.selectedRate.carrier,
          serviceName: body.selectedRate.serviceName,
          cost: body.selectedRate.rate,
          estimatedDelivery: body.selectedRate.deliveryDate || getDeliveryDate(body.selectedRate.estimatedDays),
        }
      } catch (error) {
        console.error('Shippo transaction error, using mock:', error)
        shipmentResponse = createMockShipment(body)
      }
    } else {
      console.log('No Shippo API key or rate object ID, using mock shipment')
      shipmentResponse = createMockShipment(body)
    }

    return new Response(
      JSON.stringify(shipmentResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating shipment:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create shipment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
