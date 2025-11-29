import { supabase } from '@/lib/supabase'

export interface Address {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  contactName?: string
  contactPhone?: string
}

export interface Package {
  weight: number // in lbs
  length: number // in inches
  width: number
  height: number
  description?: string
}

export interface ShippingRate {
  id: string
  carrier: string
  carrierCode: 'fedex' | 'ups' | 'usps' | 'dhl'
  serviceName: string
  serviceType: string
  rate: number
  currency: string
  estimatedDays: number
  deliveryDate?: string
}

export interface ShipmentRequest {
  origin: Address
  destination: Address
  packages: Package[]
  teeTime?: string
}

export interface ShipmentResponse {
  shipmentId: string
  trackingNumber: string
  labelUrl: string
  carrier: string
  serviceName: string
  cost: number
  estimatedDelivery: string
}

// Get shipping rates from all carriers
export async function getShippingRates(request: ShipmentRequest): Promise<ShippingRate[]> {
  try {
    const { data, error } = await supabase.functions.invoke('get-shipping-rates', {
      body: request
    })

    if (error) throw error
    return data.rates || []
  } catch (error) {
    console.error('Error fetching shipping rates:', error)
    // Return mock rates for development
    return getMockRates(request)
  }
}

// Create a shipment and get label
export async function createShipment(
  request: ShipmentRequest,
  selectedRate: ShippingRate,
  paymentIntentId: string
): Promise<ShipmentResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('create-shipment', {
      body: {
        ...request,
        selectedRate,
        paymentIntentId
      }
    })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating shipment:', error)
    throw error
  }
}

// Track a shipment
export async function trackShipment(trackingNumber: string, carrier: string) {
  try {
    const { data, error } = await supabase.functions.invoke('track-shipment', {
      body: { trackingNumber, carrier }
    })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error tracking shipment:', error)
    throw error
  }
}

// Mock rates for development/testing
function getMockRates(request: ShipmentRequest): ShippingRate[] {
  const baseWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0)
  
  const rates: ShippingRate[] = [
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
      id: 'fedex-express',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx Express Saver',
      serviceType: 'FEDEX_EXPRESS_SAVER',
      rate: 24.99 + (baseWeight * 0.75),
      currency: 'USD',
      estimatedDays: 3,
      deliveryDate: getDeliveryDate(3)
    },
    {
      id: 'fedex-overnight',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx Priority Overnight',
      serviceType: 'FEDEX_PRIORITY_OVERNIGHT',
      rate: 49.99 + (baseWeight * 1.25),
      currency: 'USD',
      estimatedDays: 1,
      deliveryDate: getDeliveryDate(1)
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
      id: 'ups-2day',
      carrier: 'UPS',
      carrierCode: 'ups',
      serviceName: 'UPS 2nd Day Air',
      serviceType: '02',
      rate: 29.99 + (baseWeight * 0.85),
      currency: 'USD',
      estimatedDays: 2,
      deliveryDate: getDeliveryDate(2)
    },
    {
      id: 'ups-nextday',
      carrier: 'UPS',
      carrierCode: 'ups',
      serviceName: 'UPS Next Day Air',
      serviceType: '01',
      rate: 54.99 + (baseWeight * 1.35),
      currency: 'USD',
      estimatedDays: 1,
      deliveryDate: getDeliveryDate(1)
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
    {
      id: 'usps-express',
      carrier: 'USPS',
      carrierCode: 'usps',
      serviceName: 'USPS Priority Mail Express',
      serviceType: 'PRIORITY_MAIL_EXPRESS',
      rate: 29.99 + (baseWeight * 0.95),
      currency: 'USD',
      estimatedDays: 1,
      deliveryDate: getDeliveryDate(1)
    },
    {
      id: 'dhl-express',
      carrier: 'DHL',
      carrierCode: 'dhl',
      serviceName: 'DHL Express Worldwide',
      serviceType: 'P',
      rate: 39.99 + (baseWeight * 1.15),
      currency: 'USD',
      estimatedDays: 2,
      deliveryDate: getDeliveryDate(2)
    }
  ]
  
  return rates.sort((a, b) => a.rate - b.rate)
}

function getDeliveryDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// Weight range to actual weight mapping
export function getWeightFromRange(range: string): number {
  switch (range) {
    case 'light': return 10
    case 'medium': return 22
    case 'heavy': return 40
    case 'extra': return 60
    default: return 25
  }
}

// Default golf bag dimensions
export function getGolfBagDimensions(): { length: number; width: number; height: number } {
  return {
    length: 50,
    width: 15,
    height: 15
  }
}
