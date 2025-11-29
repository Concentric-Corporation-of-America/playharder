# Shipping Integration Architecture

## Overview

This document outlines the backend architecture for integrating FedEx, UPS, USPS, and DHL shipping carriers into the Playharder dropshipping platform.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Playharder Frontend                          │
│                    (React + TypeScript + Vite)                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Supabase Edge Functions                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ get-rates   │  │ create-     │  │ track-      │  │ webhook-   │ │
│  │             │  │ shipment    │  │ shipment    │  │ handler    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Shipping Service Layer                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Unified Shipping Interface                      │   │
│  │  - getRates(origin, destination, packages)                   │   │
│  │  - createShipment(order, carrier, service)                   │   │
│  │  - trackShipment(trackingNumber, carrier)                    │   │
│  │  - cancelShipment(shipmentId)                                │   │
│  │  - validateAddress(address)                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────┬───────────┴───────────┬───────────────┐
        ▼               ▼                       ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    FedEx      │ │     UPS       │ │     USPS      │ │     DHL       │
│   Adapter     │ │   Adapter     │ │   Adapter     │ │   Adapter     │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
        │               │                   │               │
        ▼               ▼                   ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  FedEx API    │ │   UPS API     │ │  USPS API     │ │   DHL API     │
│  (REST)       │ │   (REST)      │ │  (XML/REST)   │ │   (REST)      │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

## Carrier Integration Details

### 1. FedEx Integration

**API Version:** FedEx REST API v1
**Base URL:** `https://apis.fedex.com` (Production) / `https://apis-sandbox.fedex.com` (Sandbox)

**Required Credentials:**
- Client ID (API Key)
- Client Secret
- Account Number
- Meter Number (for some services)

**Key Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/oauth/token` | Authentication - Get access token |
| `/rate/v1/rates/quotes` | Get shipping rates |
| `/ship/v1/shipments` | Create shipment and generate label |
| `/track/v1/trackingnumbers` | Track shipment |
| `/ship/v1/shipments/cancel` | Cancel shipment |
| `/address/v1/addresses/resolve` | Address validation |

**Authentication Flow:**
```typescript
async function getFedExToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch('https://apis.fedex.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
  });
  const data = await response.json();
  return data.access_token;
}
```

**Service Types:**
- FEDEX_GROUND
- FEDEX_EXPRESS_SAVER
- FEDEX_2_DAY
- FEDEX_PRIORITY_OVERNIGHT
- FEDEX_STANDARD_OVERNIGHT
- FEDEX_FIRST_OVERNIGHT
- FEDEX_INTERNATIONAL_PRIORITY

### 2. UPS Integration

**API Version:** UPS REST API v1
**Base URL:** `https://onlinetools.ups.com` (Production) / `https://wwwcie.ups.com` (Testing)

**Required Credentials:**
- Client ID
- Client Secret
- Account Number
- Access License Number (legacy)

**Key Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/security/v1/oauth/token` | Authentication |
| `/api/rating/v1/Shop` | Get shipping rates |
| `/api/shipments/v1/ship` | Create shipment |
| `/api/track/v1/details/{inquiryNumber}` | Track shipment |
| `/api/shipments/v1/void/cancel/{shipmentId}` | Cancel shipment |
| `/api/addressvalidation/v1/1` | Address validation |

**Service Types:**
- 03: UPS Ground
- 02: UPS 2nd Day Air
- 01: UPS Next Day Air
- 13: UPS Next Day Air Saver
- 14: UPS Next Day Air Early
- 59: UPS 2nd Day Air A.M.
- 12: UPS 3 Day Select

### 3. USPS Integration

**API Version:** USPS Web Tools API v3 / USPS REST API (new)
**Base URL:** `https://secure.shippingapis.com/ShippingAPI.dll` (Legacy) / `https://api.usps.com` (New REST)

**Required Credentials:**
- User ID (Web Tools)
- API Key (REST API)
- CRID (Customer Registration ID)
- MID (Mailer ID)

**Key Endpoints (REST API):**
| Endpoint | Purpose |
|----------|---------|
| `/oauth2/v3/token` | Authentication |
| `/prices/v3/base-rates/search` | Get shipping rates |
| `/labels/v3/label` | Create label |
| `/tracking/v3/tracking/{trackingNumber}` | Track package |
| `/addresses/v3/address` | Address validation |

**Service Types:**
- PRIORITY_MAIL
- PRIORITY_MAIL_EXPRESS
- FIRST_CLASS_MAIL
- PARCEL_SELECT
- MEDIA_MAIL
- LIBRARY_MAIL
- USPS_GROUND_ADVANTAGE

**Weight Limits:**
- First-Class Mail: Up to 13 oz
- Priority Mail: Up to 70 lbs
- Priority Mail Express: Up to 70 lbs
- USPS Ground Advantage: Up to 70 lbs

### 4. DHL Express Integration

**API Version:** DHL Express API v2
**Base URL:** `https://express.api.dhl.com/mydhlapi` (Production) / `https://express.api.dhl.com/mydhlapi/test` (Sandbox)

**Required Credentials:**
- API Key
- API Secret
- Account Number

**Key Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/rates` | Get shipping rates |
| `/shipments` | Create shipment |
| `/tracking` | Track shipment |
| `/shipments/{shipmentId}` | Cancel/void shipment |
| `/address-validate` | Address validation |

**Service Types:**
- P: Express Worldwide
- U: Express Worldwide (EU)
- K: Express 9:00
- E: Express 9:00 (Non-Doc)
- Y: Express 12:00
- T: Express 12:00 (Non-Doc)
- N: Domestic Express

## Database Schema

The dropshipping platform uses the following tables for shipping:

### shipping_carriers
Stores carrier configurations and API endpoints.

### carrier_credentials
Stores encrypted API credentials per tenant (multi-tenant support).

### dropship_shipments
Stores shipment records with tracking numbers, status, and carrier information.

### dropship_tracking_events
Stores detailed tracking history for each shipment.

### dropship_shipping_rates
Caches shipping rate quotes for performance optimization.

## Edge Function Implementation

### get-rates Edge Function

```typescript
// supabase/functions/get-rates/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RateRequest {
  origin: Address
  destination: Address
  packages: Package[]
  carriers?: string[] // Optional: filter specific carriers
}

serve(async (req) => {
  const { origin, destination, packages, carriers } = await req.json() as RateRequest
  
  // Get active carriers
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  const { data: activeCarriers } = await supabase
    .from('shipping_carriers')
    .select('*')
    .eq('is_active', true)
    .in('code', carriers || ['fedex', 'ups', 'usps', 'dhl'])
  
  // Fetch rates from all carriers in parallel
  const ratePromises = activeCarriers.map(carrier => 
    getCarrierRates(carrier, origin, destination, packages)
  )
  
  const results = await Promise.allSettled(ratePromises)
  
  // Combine and sort rates
  const allRates = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => a.rate - b.rate)
  
  return new Response(JSON.stringify({ rates: allRates }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### create-shipment Edge Function

```typescript
// supabase/functions/create-shipment/index.ts
serve(async (req) => {
  const { orderId, carrierId, serviceType } = await req.json()
  
  // 1. Get order details
  const order = await getOrder(orderId)
  
  // 2. Get carrier credentials
  const credentials = await getCarrierCredentials(order.tenant_id, carrierId)
  
  // 3. Create shipment with carrier
  const shipmentResult = await createCarrierShipment(
    credentials,
    order,
    serviceType
  )
  
  // 4. Store shipment in database
  const { data: shipment } = await supabase
    .from('dropship_shipments')
    .insert({
      order_id: orderId,
      carrier_id: carrierId,
      tracking_number: shipmentResult.trackingNumber,
      label_url: shipmentResult.labelUrl,
      status: 'label_created',
      service_type: serviceType,
      shipping_cost: shipmentResult.cost
    })
    .select()
    .single()
  
  // 5. Update order status
  await supabase
    .from('dropship_orders')
    .update({ status: 'shipped' })
    .eq('id', orderId)
  
  return new Response(JSON.stringify(shipment))
})
```

### webhook-handler Edge Function

```typescript
// supabase/functions/webhook-handler/index.ts
serve(async (req) => {
  const carrier = req.headers.get('x-carrier-source')
  const payload = await req.json()
  
  // Validate webhook signature
  const isValid = await validateWebhookSignature(req, carrier)
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 })
  }
  
  // Parse tracking event based on carrier format
  const event = parseTrackingEvent(carrier, payload)
  
  // Store tracking event
  await supabase
    .from('dropship_tracking_events')
    .insert({
      shipment_id: event.shipmentId,
      status: event.status,
      description: event.description,
      city: event.location?.city,
      state: event.location?.state,
      event_timestamp: event.timestamp
    })
  
  // Update shipment status
  await supabase
    .from('dropship_shipments')
    .update({ 
      status: mapCarrierStatus(event.status),
      updated_at: new Date().toISOString()
    })
    .eq('tracking_number', event.trackingNumber)
  
  return new Response('OK')
})
```

## Webhook Configuration

Each carrier requires webhook registration for real-time tracking updates:

### FedEx Track API Webhooks
- Register at FedEx Developer Portal
- Webhook URL: `https://blfieqovcvzgiucuymen.supabase.co/functions/v1/webhook-handler`
- Events: `DELIVERED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `EXCEPTION`

### UPS Tracking Webhooks
- Configure via UPS Developer Kit
- Webhook URL: Same as above with `x-carrier-source: ups` header
- Events: All tracking milestone events

### USPS Informed Delivery
- Register for USPS Web Tools Tracking API
- Polling-based (webhooks limited availability)
- Recommended: Poll every 2-4 hours for active shipments

### DHL Express Tracking Webhooks
- Configure via MyDHL API Portal
- Webhook URL: Same as above with `x-carrier-source: dhl` header
- Events: All shipment events

## Security Considerations

1. **Credential Storage**: All API credentials are encrypted at rest using Supabase Vault
2. **Row-Level Security**: Carrier credentials are isolated per tenant
3. **Webhook Validation**: All incoming webhooks are validated using carrier-specific signatures
4. **Rate Limiting**: API calls are rate-limited to prevent abuse
5. **Audit Logging**: All shipping operations are logged for compliance

## Error Handling

```typescript
class ShippingError extends Error {
  constructor(
    message: string,
    public carrier: string,
    public code: string,
    public retryable: boolean
  ) {
    super(message)
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (error instanceof ShippingError && !error.retryable) {
        throw error
      }
      await sleep(Math.pow(2, i) * 1000) // Exponential backoff
    }
  }
  throw lastError
}
```

## Testing Strategy

1. **Unit Tests**: Test each carrier adapter independently with mocked responses
2. **Integration Tests**: Test against carrier sandbox environments
3. **E2E Tests**: Full flow testing from rate quote to delivery confirmation
4. **Load Tests**: Ensure system handles peak shipping volumes

## Monitoring & Alerting

- Track API response times per carrier
- Monitor webhook delivery success rates
- Alert on elevated error rates
- Dashboard for shipment status distribution

## Future Enhancements

1. **Multi-carrier Rate Shopping**: Automatically select cheapest/fastest carrier
2. **Address Autocomplete**: Integration with Google Places API
3. **Insurance Integration**: Automatic shipping insurance for high-value items
4. **Returns Management**: Self-service return label generation
5. **Batch Shipping**: Process multiple shipments simultaneously
6. **Carbon Offset**: Calculate and offset shipping emissions
