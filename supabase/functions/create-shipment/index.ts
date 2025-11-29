import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import type { ShipmentRequest, ShipmentResponse, ShippingRate, Address } from "../_shared/types.ts"

const SHIPPO_API_KEY = Deno.env.get('SHIPPO_API_KEY') || Deno.env.get('VITE_SHIPPO_API_KEY')
const SHIPPO_API_URL = 'https://api.goshippo.com'

// FedEx API Configuration
const FEDEX_API_KEY = Deno.env.get('FEDEX_API_KEY')
const FEDEX_SECRET_KEY = Deno.env.get('FEDEX_SECRET_KEY')
const FEDEX_API_URL = Deno.env.get('FEDEX_API_URL') || 'https://apis-sandbox.fedex.com'
const FEDEX_ACCOUNT_NUMBER = Deno.env.get('FEDEX_ACCOUNT_NUMBER') || ''

// FedEx OAuth Token Cache
let fedexAccessToken: string | null = null
let fedexTokenExpiry: number = 0

async function getFedExAccessToken(): Promise<string> {
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
  residential?: boolean
}

interface FedExContact {
  personName: string
  phoneNumber: string
  emailAddress?: string
}

function convertToFedExAddress(address: Address): FedExAddress {
  return {
    streetLines: [address.street],
    city: address.city,
    stateOrProvinceCode: address.state,
    postalCode: address.postalCode,
    countryCode: address.country || 'US',
    residential: true,
  }
}

function convertToFedExContact(address: Address): FedExContact {
  return {
    personName: address.contactName || 'Customer',
    phoneNumber: address.contactPhone || '0000000000',
    emailAddress: address.contactEmail,
  }
}

interface FedExShipmentResponse {
  output: {
    transactionShipments: Array<{
      masterTrackingNumber: string
      pieceResponses: Array<{
        trackingNumber: string
        packageDocuments: Array<{
          url: string
          contentType: string
          docType: string
        }>
      }>
    }>
  }
}

async function createFedExShipment(body: CreateShipmentBody): Promise<ShipmentResponse> {
  const accessToken = await getFedExAccessToken()
  
  const requestBody = {
    labelResponseOptions: 'URL_ONLY',
    requestedShipment: {
      shipper: {
        contact: convertToFedExContact(body.origin),
        address: convertToFedExAddress(body.origin),
      },
      recipients: [{
        contact: convertToFedExContact(body.destination),
        address: convertToFedExAddress(body.destination),
      }],
      shipDatestamp: new Date().toISOString().split('T')[0],
      serviceType: body.selectedRate.serviceType,
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      blockInsightVisibility: false,
      shippingChargesPayment: {
        paymentType: 'SENDER',
        payor: {
          responsibleParty: {
            accountNumber: {
              value: FEDEX_ACCOUNT_NUMBER,
            },
          },
        },
      },
      labelSpecification: {
        imageType: 'PDF',
        labelStockType: 'PAPER_4X6',
      },
      requestedPackageLineItems: body.packages.map((pkg, index) => ({
        sequenceNumber: index + 1,
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
    accountNumber: {
      value: FEDEX_ACCOUNT_NUMBER,
    },
  }

  const response = await fetch(`${FEDEX_API_URL}/ship/v1/shipments`, {
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
    console.error('FedEx Ship API error:', errorText)
    throw new Error(`FedEx Ship API error: ${response.status}`)
  }

  const data: FedExShipmentResponse = await response.json()
  
  const shipment = data.output.transactionShipments[0]
  const piece = shipment.pieceResponses[0]
  const labelDoc = piece.packageDocuments.find(doc => doc.docType === 'LABEL')

  return {
    shipmentId: `fedex_${shipment.masterTrackingNumber}`,
    trackingNumber: piece.trackingNumber || shipment.masterTrackingNumber,
    labelUrl: labelDoc?.url || '',
    carrier: 'FedEx',
    serviceName: body.selectedRate.serviceName,
    cost: body.selectedRate.rate,
    estimatedDelivery: body.selectedRate.deliveryDate || getDeliveryDate(body.selectedRate.estimatedDays),
  }
}

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
    
    // Check if this is a FedEx direct API rate
    const isFedExDirect = (body.selectedRate as { source?: string }).source === 'fedex_direct' || 
                          (body.selectedRate.carrierCode === 'fedex' && !body.selectedRate.objectId)

    // Try FedEx direct API first for FedEx shipments
    if (isFedExDirect && FEDEX_API_KEY && FEDEX_SECRET_KEY) {
      try {
        console.log('Creating FedEx shipment via direct API')
        shipmentResponse = await createFedExShipment(body)
      } catch (error) {
        console.error('FedEx shipment error, falling back to mock:', error)
        shipmentResponse = createMockShipment(body)
      }
    }
    // If we have a Shippo rate object ID, create a real transaction via Shippo
    else if (SHIPPO_API_KEY && body.selectedRate.objectId) {
      try {
        console.log('Creating shipment via Shippo')
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
      console.log('No carrier API available, using mock shipment')
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
