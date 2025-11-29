export interface Address {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
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
  carrierCode: string
  serviceName: string
  serviceType: string
  rate: number
  currency: string
  estimatedDays: number
  deliveryDate?: string
  objectId?: string // Shippo rate object ID
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

export interface ShippoAddress {
  name: string
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
  email?: string
}

export interface ShippoParcel {
  length: string
  width: string
  height: string
  distance_unit: string
  weight: string
  mass_unit: string
}
