import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, CreditCard, Truck, ArrowLeft, Printer, CheckCircle, Shield, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import AddressAutocomplete, { parseGooglePlace } from '@/components/AddressAutocomplete'
import { supabase } from '@/lib/supabase'
import { 
  getShippingRates, 
  createShipment,
  getWeightFromRange,
  getGolfBagDimensions,
  getPricingConfig,
  getInsuranceOptions,
  validatePromoCode,
  calculateDiscount,
  type ShippingRate,
  type ShipmentRequest,
  type ShipmentResponse,
  type PricingConfig,
  type InsuranceOption,
  type PromoCode
} from '@/services/shippingService'

// Re-export ParsedAddress type for use in callbacks
type PlaceResult = Parameters<typeof parseGooglePlace>[0]

type CheckoutStep = 'addresses' | 'rates' | 'payment' | 'confirmation'

interface AddressForm {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  contactName: string
  contactPhone: string
}

const emptyAddress: AddressForm = {
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  contactName: '',
  contactPhone: ''
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // Get initial values from URL params (from landing page)
  const initialPickup = searchParams.get('pickup') || ''
  const initialDropoff = searchParams.get('dropoff') || ''
  const initialWeight = searchParams.get('weight') || 'medium'
  const initialTeeTime = searchParams.get('teeTime') || ''

  const [step, setStep] = useState<CheckoutStep>('addresses')
  const [isLoading, setIsLoading] = useState(false)
  
  // Address state
  const [pickupAddress, setPickupAddress] = useState<AddressForm>({ ...emptyAddress })
  const [deliveryAddress, setDeliveryAddress] = useState<AddressForm>({ ...emptyAddress })
  const [pickupFormatted, setPickupFormatted] = useState(initialPickup)
  const [deliveryFormatted, setDeliveryFormatted] = useState(initialDropoff)
  
  // Shipping state
  const [weightRange] = useState(initialWeight)
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null)
  
  // Pricing state
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null)
  const [_insuranceOptions, setInsuranceOptions] = useState<InsuranceOption[]>([])
  const [selectedInsurance, setSelectedInsurance] = useState<InsuranceOption | null>(null)
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null)
  const [isValidatingPromo, setIsValidatingPromo] = useState(false)
  
  // Payment state
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const [cardName, setCardName] = useState('')
  
  // Confirmation state
  const [shipment, setShipment] = useState<ShipmentResponse | null>(null)
  
  // User email for notifications
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  // Get user email and pricing config on mount
  useEffect(() => {
    const initializeData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
      }
      
      const [config, insurance] = await Promise.all([
        getPricingConfig(),
        getInsuranceOptions()
      ])
      setPricingConfig(config)
      setInsuranceOptions(insurance)
      const complimentary = insurance.find(opt => opt.isComplimentary)
      if (complimentary) {
        setSelectedInsurance(complimentary)
      }
    }
    initializeData()
  }, [])
  
  // Send order confirmation email
  const sendOrderConfirmationEmail = async (shipmentResult: ShipmentResponse) => {
    if (!userEmail) {
      console.log('No user email available for notification')
      return
    }
    
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: userEmail,
          template: 'order_confirmation',
          data: {
            customerName: pickupAddress.contactName || 'Golfer',
            orderNumber: shipmentResult.shipmentId,
            trackingNumber: shipmentResult.trackingNumber,
            carrier: shipmentResult.carrier,
            estimatedDelivery: shipmentResult.estimatedDelivery,
            deliveryAddress: `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.state} ${deliveryAddress.postalCode}`,
            items: [{ name: 'Golf Equipment Shipment', quantity: 1 }]
          }
        }
      })
      
      if (error) {
        console.error('Failed to send confirmation email:', error)
      } else {
        console.log('Order confirmation email sent successfully')
      }
    } catch (err) {
      console.error('Error sending confirmation email:', err)
      // Don't throw - email failure shouldn't break the checkout flow
    }
  }

  // Handle address autocomplete selection
  const handlePickupChange = useCallback((value: string, place?: PlaceResult) => {
    setPickupFormatted(value)
    if (place) {
      const parsed = parseGooglePlace(place)
      setPickupAddress({
        street: parsed.street,
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        country: parsed.country || 'US',
        contactName: pickupAddress.contactName,
        contactPhone: pickupAddress.contactPhone
      })
    }
  }, [pickupAddress.contactName, pickupAddress.contactPhone])

  const handleDeliveryChange = useCallback((value: string, place?: PlaceResult) => {
    setDeliveryFormatted(value)
    if (place) {
      const parsed = parseGooglePlace(place)
      setDeliveryAddress({
        street: parsed.street,
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        country: parsed.country || 'US',
        contactName: deliveryAddress.contactName,
        contactPhone: deliveryAddress.contactPhone
      })
    }
  }, [deliveryAddress.contactName, deliveryAddress.contactPhone])

  // Fetch shipping rates
  const fetchRates = async () => {
    if (!pickupAddress.street || !deliveryAddress.street) {
      toast.error('Please enter valid pickup and delivery addresses')
      return
    }

    setIsLoading(true)
    try {
      const dimensions = getGolfBagDimensions()
      const weight = getWeightFromRange(weightRange)

      const request: ShipmentRequest = {
        origin: {
          street: pickupAddress.street,
          city: pickupAddress.city,
          state: pickupAddress.state,
          postalCode: pickupAddress.postalCode,
          country: pickupAddress.country,
          contactName: pickupAddress.contactName,
          contactPhone: pickupAddress.contactPhone
        },
        destination: {
          street: deliveryAddress.street,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          postalCode: deliveryAddress.postalCode,
          country: deliveryAddress.country,
          contactName: deliveryAddress.contactName,
          contactPhone: deliveryAddress.contactPhone
        },
        packages: [{
          weight,
          ...dimensions,
          description: 'Golf equipment'
        }],
        teeTime: initialTeeTime
      }

      const fetchedRates = await getShippingRates(request)
      setRates(fetchedRates)
      setStep('rates')
      toast.success(`Found ${fetchedRates.length} shipping options`)
    } catch (error) {
      console.error('Error fetching rates:', error)
      toast.error('Failed to fetch shipping rates. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Process payment and create shipment
  const processPayment = async () => {
    if (!selectedRate) {
      toast.error('Please select a shipping option')
      return
    }

    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      toast.error('Please fill in all payment details')
      return
    }

    setIsLoading(true)
    try {
      // In production, this would use Stripe Elements
      // For now, simulate payment processing
      const mockPaymentIntentId = `pi_${Date.now()}_mock`

      const dimensions = getGolfBagDimensions()
      const weight = getWeightFromRange(weightRange)

      const request: ShipmentRequest = {
        origin: {
          street: pickupAddress.street,
          city: pickupAddress.city,
          state: pickupAddress.state,
          postalCode: pickupAddress.postalCode,
          country: pickupAddress.country,
          contactName: pickupAddress.contactName,
          contactPhone: pickupAddress.contactPhone
        },
        destination: {
          street: deliveryAddress.street,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          postalCode: deliveryAddress.postalCode,
          country: deliveryAddress.country,
          contactName: deliveryAddress.contactName,
          contactPhone: deliveryAddress.contactPhone
        },
        packages: [{
          weight,
          ...dimensions,
          description: 'Golf equipment'
        }]
      }

      const shipmentResult = await createShipment(request, selectedRate, mockPaymentIntentId)
      setShipment(shipmentResult)
      setStep('confirmation')
      toast.success('Shipment created successfully!')
      
      // Send order confirmation email (non-blocking)
      sendOrderConfirmationEmail(shipmentResult)
    } catch (error) {
      console.error('Error processing payment:', error)
      // For demo, create mock shipment
      const mockShipment: ShipmentResponse = {
        shipmentId: `ship_${Date.now()}`,
        trackingNumber: `1Z999AA10123456784`,
        labelUrl: 'https://shippo-delivery-east.s3.amazonaws.com/sample_label.pdf',
        carrier: selectedRate.carrier,
        serviceName: selectedRate.serviceName,
        cost: selectedRate.rate,
        estimatedDelivery: selectedRate.deliveryDate || 'TBD'
      }
      setShipment(mockShipment)
      setStep('confirmation')
      toast.success('Shipment created (demo mode)')
      
      // Send order confirmation email (non-blocking)
      sendOrderConfirmationEmail(mockShipment)
    } finally {
      setIsLoading(false)
    }
  }

  // Print shipping label
  const printLabel = () => {
    if (shipment?.labelUrl) {
      window.open(shipment.labelUrl, '_blank')
    }
  }

  // Get carrier logo/color
  const getCarrierColor = (carrier: string) => {
    switch (carrier.toLowerCase()) {
      case 'fedex': return 'text-purple-400 border-purple-400/30'
      case 'ups': return 'text-amber-400 border-amber-400/30'
      case 'usps': return 'text-blue-400 border-blue-400/30'
      case 'dhl': return 'text-yellow-400 border-yellow-400/30'
      default: return 'text-cosmic-cyan border-cosmic-cyan/30'
    }
  }

  // Handle promo code validation
  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) {
      toast.error('Please enter a promo code')
      return
    }
    
    setIsValidatingPromo(true)
    try {
      const promo = await validatePromoCode(promoCodeInput.trim())
      if (promo) {
        setAppliedPromo(promo)
        toast.success(`Promo code "${promo.code}" applied! ${promo.description}`)
      } else {
        toast.error('Invalid or expired promo code')
      }
    } catch {
      toast.error('Failed to validate promo code')
    } finally {
      setIsValidatingPromo(false)
    }
  }

  // Calculate total price with discount
  const calculateTotal = () => {
    if (!selectedRate) return 0
    const subtotal = selectedRate.rate
    const discount = calculateDiscount(subtotal, appliedPromo)
    return Number((subtotal - discount).toFixed(2))
  }

  // Get discount amount
  const getDiscountAmount = () => {
    if (!selectedRate || !appliedPromo) return 0
    return calculateDiscount(selectedRate.rate, appliedPromo)
  }

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-cosmic-cyan hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold text-white">Ship Your Gear</h1>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-10">
          {['addresses', 'rates', 'payment', 'confirmation'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step === s ? 'bg-cosmic-cyan text-cosmic-dark' :
                ['addresses', 'rates', 'payment', 'confirmation'].indexOf(step) > i 
                  ? 'bg-cosmic-purple text-white' 
                  : 'bg-cosmic-darker text-gray-500 border border-cosmic-purple/30'
              }`}>
                {i + 1}
              </div>
              {i < 3 && (
                <div className={`w-16 md:w-24 h-1 mx-2 ${
                  ['addresses', 'rates', 'payment', 'confirmation'].indexOf(step) > i 
                    ? 'bg-cosmic-purple' 
                    : 'bg-cosmic-darker'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Addresses */}
        {step === 'addresses' && (
          <div className="glass-card rounded-2xl p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-cosmic-cyan" />
              Shipping Addresses
            </h2>

            {/* Pickup Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-cosmic-pink">Pickup Location</h3>
              <AddressAutocomplete
                value={pickupFormatted}
                onChange={handlePickupChange}
                placeholder="Where are your clubs?"
                label="Address"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Contact Name"
                  value={pickupAddress.contactName}
                  onChange={(e) => setPickupAddress({ ...pickupAddress, contactName: e.target.value })}
                  className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500"
                />
                <Input
                  placeholder="Phone Number"
                  value={pickupAddress.contactPhone}
                  onChange={(e) => setPickupAddress({ ...pickupAddress, contactPhone: e.target.value })}
                  className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Delivery Address */}
            <div className="space-y-4 pt-4 border-t border-cosmic-purple/30">
              <h3 className="text-lg font-semibold text-cosmic-cyan">Delivery Location</h3>
              <AddressAutocomplete
                value={deliveryFormatted}
                onChange={handleDeliveryChange}
                placeholder="Where do they need to land?"
                label="Address"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Contact Name"
                  value={deliveryAddress.contactName}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, contactName: e.target.value })}
                  className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500"
                />
                <Input
                  placeholder="Phone Number"
                  value={deliveryAddress.contactPhone}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, contactPhone: e.target.value })}
                  className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <Button
              onClick={fetchRates}
              disabled={isLoading || !pickupFormatted || !deliveryFormatted}
              className="w-full cosmic-button text-white font-bold py-4 rounded-xl text-lg"
            >
              {isLoading ? 'Finding Best Rates...' : 'Get Shipping Rates'}
            </Button>
          </div>
        )}

        {/* Step 2: Rate Selection */}
        {step === 'rates' && (
          <div className="glass-card rounded-2xl p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-cosmic-cyan" />
              Select Shipping Option
            </h2>

            {pricingConfig?.insuranceMessaging.enabled && (
              <div className="flex items-center gap-2 bg-cosmic-purple/20 rounded-lg p-3 border border-cosmic-purple/30">
                <Shield className="w-5 h-5 text-cosmic-cyan flex-shrink-0" />
                <span className="text-sm text-gray-300">
                  {pricingConfig.insuranceMessaging.message}
                </span>
              </div>
            )}

            <div className="space-y-3">
              {rates.map((rate) => (
                <button
                  key={rate.id}
                  onClick={() => setSelectedRate(rate)}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    selectedRate?.id === rate.id
                      ? 'border-cosmic-cyan bg-cosmic-cyan/10'
                      : `border-cosmic-purple/30 hover:border-cosmic-purple/50 ${getCarrierColor(rate.carrier)}`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${getCarrierColor(rate.carrier).split(' ')[0]}`}>
                          {rate.carrier}
                        </span>
                        <span className="text-white">{rate.serviceName}</span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Estimated delivery: {rate.estimatedDays} day{rate.estimatedDays > 1 ? 's' : ''}
                        {rate.deliveryDate && ` (${rate.deliveryDate})`}
                      </p>
                      {pricingConfig?.showPriceBreakdown && (
                        <p className="text-gray-500 text-xs mt-1">
                          Carrier ${rate.baseRate?.toFixed(2) || '0.00'} + Service ${rate.serviceFee?.toFixed(2) || '0.00'}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-white">
                        ${rate.rate.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setStep('addresses')}
                className="flex-1 border-cosmic-purple/30 text-cosmic-cyan hover:bg-cosmic-purple/20"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('payment')}
                disabled={!selectedRate}
                className="flex-1 cosmic-button text-white font-bold"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 'payment' && selectedRate && (
          <div className="glass-card rounded-2xl p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-cosmic-cyan" />
              Payment Details
            </h2>

            {/* Order Summary with Price Breakdown */}
            <div className="bg-cosmic-darker rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-gray-400">
                <span>{selectedRate.carrier} {selectedRate.serviceName}</span>
              </div>
              {pricingConfig?.showPriceBreakdown && (
                <>
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>Carrier Rate</span>
                    <span>${selectedRate.baseRate?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>Service Fee</span>
                    <span>${selectedRate.serviceFee?.toFixed(2) || '0.00'}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>${selectedRate.rate.toFixed(2)}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-green-400">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {appliedPromo.code}
                  </span>
                  <span>-${getDiscountAmount().toFixed(2)}</span>
                </div>
              )}
              {pricingConfig?.insuranceMessaging.enabled && selectedInsurance && (
                <div className="flex justify-between text-gray-500 text-sm">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {selectedInsurance.name}
                  </span>
                  <span>{selectedInsurance.isComplimentary ? 'Included' : `$${selectedInsurance.premiumFixed.toFixed(2)}`}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-cosmic-purple/30">
                <span>Total</span>
                <span className="text-cosmic-cyan">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Have a promo code?</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  disabled={!!appliedPromo}
                  className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500 flex-1"
                />
                {appliedPromo ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAppliedPromo(null)
                      setPromoCodeInput('')
                    }}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleApplyPromoCode}
                    disabled={isValidatingPromo || !promoCodeInput.trim()}
                    className="border-cosmic-purple/30 text-cosmic-cyan hover:bg-cosmic-purple/20"
                  >
                    {isValidatingPromo ? 'Checking...' : 'Apply'}
                  </Button>
                )}
              </div>
              {appliedPromo && (
                <p className="text-xs text-green-400">{appliedPromo.description}</p>
              )}
            </div>

            {/* Card Form */}
            <div className="space-y-4">
              <Input
                placeholder="Name on Card"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500"
              />
              <Input
                placeholder="Card Number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '')
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + '/' + value.slice(2, 4)
                    }
                    setCardExpiry(value)
                  }}
                  className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500"
                />
                <Input
                  placeholder="CVC"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="bg-cosmic-darker border-cosmic-purple/30 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Demo mode: Use any card details. In production, this uses Stripe secure checkout.
            </p>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setStep('rates')}
                className="flex-1 border-cosmic-purple/30 text-cosmic-cyan hover:bg-cosmic-purple/20"
              >
                Back
              </Button>
              <Button
                onClick={processPayment}
                disabled={isLoading}
                className="flex-1 cosmic-button text-white font-bold"
              >
                {isLoading ? 'Processing...' : `Pay $${calculateTotal().toFixed(2)}`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 'confirmation' && shipment && (
          <div className="glass-card rounded-2xl p-8 space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-cosmic-cyan/20 to-cosmic-purple/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-cosmic-cyan" />
            </div>

            <h2 className="text-2xl font-bold text-white">
              Launch Sequence Complete!
            </h2>
            <p className="text-gray-400">
              Your gear is on its way to the stars.
            </p>

            {/* Shipment Details */}
            <div className="bg-cosmic-darker rounded-xl p-6 text-left space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Tracking Number</span>
                <span className="text-cosmic-cyan font-mono">{shipment.trackingNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Carrier</span>
                <span className="text-white">{shipment.carrier} - {shipment.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated Delivery</span>
                <span className="text-white">{shipment.estimatedDelivery}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Cost</span>
                <span className="text-cosmic-pink font-bold">${shipment.cost.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={printLabel}
                className="w-full cosmic-button text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print Shipping Label
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="w-full border-cosmic-purple/30 text-cosmic-cyan hover:bg-cosmic-purple/20"
              >
                Track Your Shipment
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-gray-400 hover:text-white"
              >
                Ship Another Package
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
