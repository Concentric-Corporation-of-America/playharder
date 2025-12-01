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
  baseRate: number
  serviceFee: number
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

export interface PricingConfig {
  baseMarkupPerWay: number
  showPriceBreakdown: boolean
  insuranceMessaging: {
    enabled: boolean
    defaultCoverage: number
    message: string
  }
}

export interface InsuranceOption {
  id: string
  name: string
  coverageAmount: number
  premiumPercentage: number
  premiumFixed: number
  isComplimentary: boolean
  description: string
}

export interface PromoCode {
  id: string
  code: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  minOrderAmount: number
  description: string
}

export interface PricingRule {
  id: string
  ruleName: string
  ruleType: 'distance' | 'weight' | 'service_level' | 'time_of_year' | 'partner'
  conditions: Record<string, unknown>
  markupType: 'percentage' | 'fixed_amount'
  markupValue: number
  priority: number
}

let cachedPricingConfig: PricingConfig | null = null
let cachedInsuranceOptions: InsuranceOption[] | null = null
let cachedPricingRules: PricingRule[] | null = null

export async function getPricingConfig(): Promise<PricingConfig> {
  if (cachedPricingConfig) return cachedPricingConfig

  try {
    const { data, error } = await supabase
      .from('dropship_pricing_config')
      .select('config_key, config_value')
      .eq('is_active', true)

    if (error) throw error

    const config: PricingConfig = {
      baseMarkupPerWay: 25,
      showPriceBreakdown: true,
      insuranceMessaging: {
        enabled: true,
        defaultCoverage: 1000,
        message: 'Includes $1,000 complimentary gear protection'
      }
    }

    if (data) {
      for (const row of data) {
        if (row.config_key === 'base_markup_per_way') {
          config.baseMarkupPerWay = row.config_value.amount || 25
        } else if (row.config_key === 'show_price_breakdown') {
          config.showPriceBreakdown = row.config_value.enabled !== false
        } else if (row.config_key === 'insurance_messaging') {
          config.insuranceMessaging = {
            enabled: row.config_value.enabled !== false,
            defaultCoverage: row.config_value.default_coverage || 1000,
            message: row.config_value.message || config.insuranceMessaging.message
          }
        }
      }
    }

    cachedPricingConfig = config
    return config
  } catch (error) {
    console.error('Error fetching pricing config:', error)
    return {
      baseMarkupPerWay: 25,
      showPriceBreakdown: true,
      insuranceMessaging: {
        enabled: true,
        defaultCoverage: 1000,
        message: 'Includes $1,000 complimentary gear protection'
      }
    }
  }
}

export async function getInsuranceOptions(): Promise<InsuranceOption[]> {
  if (cachedInsuranceOptions) return cachedInsuranceOptions

  try {
    const { data, error } = await supabase
      .from('dropship_insurance_options')
      .select('*')
      .eq('is_active', true)
      .order('coverage_amount', { ascending: true })

    if (error) throw error

    const options: InsuranceOption[] = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      coverageAmount: Number(row.coverage_amount),
      premiumPercentage: Number(row.premium_percentage),
      premiumFixed: Number(row.premium_fixed),
      isComplimentary: row.is_complimentary,
      description: row.description
    }))

    cachedInsuranceOptions = options
    return options
  } catch (error) {
    console.error('Error fetching insurance options:', error)
    return [{
      id: 'default',
      name: 'Basic Protection',
      coverageAmount: 1000,
      premiumPercentage: 0,
      premiumFixed: 0,
      isComplimentary: true,
      description: 'Complimentary $1,000 coverage included with every shipment'
    }]
  }
}

export async function getPricingRules(): Promise<PricingRule[]> {
  if (cachedPricingRules) return cachedPricingRules

  try {
    const { data, error } = await supabase
      .from('dropship_pricing_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) throw error

    const rules: PricingRule[] = (data || []).map(row => ({
      id: row.id,
      ruleName: row.rule_name,
      ruleType: row.rule_type,
      conditions: row.conditions,
      markupType: row.markup_type,
      markupValue: Number(row.markup_value),
      priority: row.priority
    }))

    cachedPricingRules = rules
    return rules
  } catch (error) {
    console.error('Error fetching pricing rules:', error)
    return []
  }
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  try {
    const { data, error } = await supabase
      .from('dropship_promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (error || !data) return null

    const now = new Date()
    if (data.valid_from && new Date(data.valid_from) > now) return null
    if (data.valid_until && new Date(data.valid_until) < now) return null
    if (data.max_uses && data.current_uses >= data.max_uses) return null

    return {
      id: data.id,
      code: data.code,
      discountType: data.discount_type,
      discountValue: Number(data.discount_value),
      minOrderAmount: Number(data.min_order_amount || 0),
      description: data.description
    }
  } catch (error) {
    console.error('Error validating promo code:', error)
    return null
  }
}

export function calculateDiscount(subtotal: number, promoCode: PromoCode | null): number {
  if (!promoCode) return 0
  if (subtotal < promoCode.minOrderAmount) return 0

  if (promoCode.discountType === 'percentage') {
    return Number((subtotal * (promoCode.discountValue / 100)).toFixed(2))
  }
  return Math.min(promoCode.discountValue, subtotal)
}

export function calculateInsurancePremium(
  declaredValue: number,
  option: InsuranceOption
): number {
  if (option.isComplimentary) return 0
  const percentagePremium = declaredValue * option.premiumPercentage
  return Number((percentagePremium + option.premiumFixed).toFixed(2))
}

function getServiceLevelFromType(serviceType: string): string {
  const expressTypes = ['overnight', 'priority', 'express', '2day', '2_day']
  const lowerType = serviceType.toLowerCase()
  for (const t of expressTypes) {
    if (lowerType.includes(t)) return 'express'
  }
  return 'standard'
}

async function calculateDynamicMarkup(
  baseMarkup: number,
  rate: { serviceType: string },
  _request: ShipmentRequest
): Promise<number> {
  const rules = await getPricingRules()
  let finalMarkup = baseMarkup

  for (const rule of rules) {
    if (rule.ruleType === 'service_level') {
      const serviceLevel = getServiceLevelFromType(rate.serviceType)
      const targetLevels = rule.conditions.service_types as string[] || []
      if (targetLevels.some(t => serviceLevel.includes(t) || rate.serviceType.toLowerCase().includes(t))) {
        if (rule.markupType === 'percentage') {
          finalMarkup = finalMarkup * (1 + rule.markupValue / 100)
        } else {
          finalMarkup = rule.markupValue
        }
      }
    }
  }

  return Number(finalMarkup.toFixed(2))
}

async function applyMarkup(
  rates: Array<Omit<ShippingRate, 'baseRate' | 'serviceFee'>>,
  request: ShipmentRequest
): Promise<ShippingRate[]> {
  const config = await getPricingConfig()

  const ratesWithMarkup = await Promise.all(
    rates.map(async (rate) => {
      const markup = await calculateDynamicMarkup(config.baseMarkupPerWay, rate, request)
      return {
        ...rate,
        baseRate: rate.rate,
        serviceFee: markup,
        rate: Number((rate.rate + markup).toFixed(2))
      }
    })
  )

  return ratesWithMarkup
}

export async function getShippingRates(request: ShipmentRequest): Promise<ShippingRate[]> {
  try {
    const { data, error } = await supabase.functions.invoke('get-shipping-rates', {
      body: request
    })

    if (error) throw error
    const allRates = data.rates || []
    const fedexRates = allRates.filter((rate: ShippingRate) => 
      rate.carrierCode === 'fedex' || rate.carrier?.toLowerCase().includes('fedex')
    )
    const ratesWithMarkup = await applyMarkup(
      fedexRates.length > 0 ? fedexRates : getMockRates(request),
      request
    )
    return ratesWithMarkup
  } catch (error) {
    console.error('Error fetching shipping rates:', error)
    return await applyMarkup(getMockRates(request), request)
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

type BaseRate = Omit<ShippingRate, 'baseRate' | 'serviceFee'>

function getMockRates(request: ShipmentRequest): BaseRate[] {
  const baseWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0)
  
  const rates: BaseRate[] = [
    {
      id: 'fedex-ground',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx Ground',
      serviceType: 'FEDEX_GROUND',
      rate: 29.99 + (baseWeight * 0.5),
      currency: 'USD',
      estimatedDays: 5,
      deliveryDate: getDeliveryDate(5)
    },
    {
      id: 'fedex-home',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx Home Delivery',
      serviceType: 'GROUND_HOME_DELIVERY',
      rate: 34.99 + (baseWeight * 0.55),
      currency: 'USD',
      estimatedDays: 4,
      deliveryDate: getDeliveryDate(4)
    },
    {
      id: 'fedex-express',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx Express Saver',
      serviceType: 'FEDEX_EXPRESS_SAVER',
      rate: 49.99 + (baseWeight * 0.75),
      currency: 'USD',
      estimatedDays: 3,
      deliveryDate: getDeliveryDate(3)
    },
    {
      id: 'fedex-2day',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx 2Day',
      serviceType: 'FEDEX_2_DAY',
      rate: 64.99 + (baseWeight * 0.95),
      currency: 'USD',
      estimatedDays: 2,
      deliveryDate: getDeliveryDate(2)
    },
    {
      id: 'fedex-overnight',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx Standard Overnight',
      serviceType: 'STANDARD_OVERNIGHT',
      rate: 89.99 + (baseWeight * 1.25),
      currency: 'USD',
      estimatedDays: 1,
      deliveryDate: getDeliveryDate(1)
    },
    {
      id: 'fedex-priority',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      serviceName: 'FedEx Priority Overnight',
      serviceType: 'PRIORITY_OVERNIGHT',
      rate: 109.99 + (baseWeight * 1.45),
      currency: 'USD',
      estimatedDays: 1,
      deliveryDate: getDeliveryDate(1)
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
