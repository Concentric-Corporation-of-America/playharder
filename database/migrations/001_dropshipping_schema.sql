-- Playharder Dropshipping Platform Database Schema
-- This schema is designed to integrate with the workharder Supabase project
-- for shared authentication and multi-tenant support

-- ============================================
-- SHIPPING CARRIERS TABLE
-- Stores carrier configurations for FedEx, UPS, USPS, DHL
-- ============================================
CREATE TABLE IF NOT EXISTS public.shipping_carriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE CHECK (code IN ('fedex', 'ups', 'usps', 'dhl')),
    name VARCHAR(100) NOT NULL,
    api_endpoint VARCHAR(500),
    api_version VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    supports_tracking BOOLEAN DEFAULT true,
    supports_rates BOOLEAN DEFAULT true,
    supports_labels BOOLEAN DEFAULT true,
    max_weight_lbs DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CARRIER CREDENTIALS TABLE
-- Stores encrypted API credentials per tenant
-- ============================================
CREATE TABLE IF NOT EXISTS public.carrier_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    carrier_id UUID NOT NULL REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
    account_number VARCHAR(100),
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    meter_number VARCHAR(50),
    is_test_mode BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, carrier_id)
);

-- ============================================
-- PRODUCTS TABLE
-- Golf equipment and accessories for dropshipping
-- ============================================
CREATE TABLE IF NOT EXISTS public.dropship_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    weight_lbs DECIMAL(10,2) NOT NULL,
    length_in DECIMAL(10,2),
    width_in DECIMAL(10,2),
    height_in DECIMAL(10,2),
    is_fragile BOOLEAN DEFAULT false,
    requires_signature BOOLEAN DEFAULT false,
    supplier_id UUID,
    supplier_sku VARCHAR(100),
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    image_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, sku)
);

-- ============================================
-- CUSTOMERS TABLE
-- Customer information for shipping
-- ============================================
CREATE TABLE IF NOT EXISTS public.dropship_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    company_name VARCHAR(255),
    -- Shipping Address
    shipping_street VARCHAR(255),
    shipping_street2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(50),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(2) DEFAULT 'US',
    -- Billing Address
    billing_street VARCHAR(255),
    billing_street2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(50),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(2) DEFAULT 'US',
    billing_same_as_shipping BOOLEAN DEFAULT true,
    -- Preferences
    preferred_carrier_id UUID REFERENCES public.shipping_carriers(id),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- ============================================
-- ORDERS TABLE
-- Main orders table for dropshipping
-- ============================================
CREATE TABLE IF NOT EXISTS public.dropship_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.dropship_customers(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'processing', 'shipped', 
        'in_transit', 'out_for_delivery', 'delivered', 
        'cancelled', 'returned', 'refunded'
    )),
    -- Pickup Location (for golf gear)
    pickup_street VARCHAR(255),
    pickup_city VARCHAR(100),
    pickup_state VARCHAR(50),
    pickup_postal_code VARCHAR(20),
    pickup_country VARCHAR(2) DEFAULT 'US',
    pickup_contact_name VARCHAR(200),
    pickup_contact_phone VARCHAR(50),
    -- Delivery Location
    delivery_street VARCHAR(255),
    delivery_street2 VARCHAR(255),
    delivery_city VARCHAR(100),
    delivery_state VARCHAR(50),
    delivery_postal_code VARCHAR(20),
    delivery_country VARCHAR(2) DEFAULT 'US',
    delivery_contact_name VARCHAR(200),
    delivery_contact_phone VARCHAR(50),
    delivery_instructions TEXT,
    -- Golf-specific fields
    tee_time TIMESTAMPTZ,
    course_name VARCHAR(255),
    -- Pricing
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    -- Weight
    total_weight_lbs DECIMAL(10,2),
    weight_range VARCHAR(50),
    -- Payment
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'authorized', 'captured', 'failed', 'refunded'
    )),
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    -- Metadata
    source VARCHAR(50) DEFAULT 'web',
    notes TEXT,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, order_number)
);

-- ============================================
-- ORDER ITEMS TABLE
-- Individual items within an order
-- ============================================
CREATE TABLE IF NOT EXISTS public.dropship_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.dropship_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.dropship_products(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    weight_lbs DECIMAL(10,2),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SHIPMENTS TABLE
-- Shipment records linked to orders
-- ============================================
CREATE TABLE IF NOT EXISTS public.dropship_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.dropship_orders(id) ON DELETE CASCADE,
    carrier_id UUID NOT NULL REFERENCES public.shipping_carriers(id) ON DELETE RESTRICT,
    tracking_number VARCHAR(100),
    carrier_tracking_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'label_created' CHECK (status IN (
        'label_created', 'picked_up', 'in_transit', 
        'out_for_delivery', 'delivered', 'exception', 
        'returned', 'cancelled'
    )),
    -- Label Information
    label_url TEXT,
    label_format VARCHAR(20) DEFAULT 'PDF',
    label_created_at TIMESTAMPTZ,
    -- Service Details
    service_type VARCHAR(100),
    service_name VARCHAR(255),
    -- Dates
    ship_date DATE,
    estimated_delivery_date DATE,
    actual_delivery_date DATE,
    -- Costs
    shipping_cost DECIMAL(10,2),
    insurance_cost DECIMAL(10,2),
    declared_value DECIMAL(10,2),
    -- Package Details
    package_weight_lbs DECIMAL(10,2),
    package_length_in DECIMAL(10,2),
    package_width_in DECIMAL(10,2),
    package_height_in DECIMAL(10,2),
    package_type VARCHAR(50),
    -- Signature
    signature_required BOOLEAN DEFAULT false,
    signature_name VARCHAR(200),
    signature_timestamp TIMESTAMPTZ,
    -- Metadata
    carrier_response JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRACKING EVENTS TABLE
-- Detailed tracking history for shipments
-- ============================================
CREATE TABLE IF NOT EXISTS public.dropship_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.dropship_shipments(id) ON DELETE CASCADE,
    status VARCHAR(100) NOT NULL,
    status_code VARCHAR(50),
    description TEXT,
    -- Location
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(2),
    -- Timestamps
    event_timestamp TIMESTAMPTZ NOT NULL,
    carrier_timestamp TIMESTAMPTZ,
    -- Raw carrier data
    carrier_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SHIPPING RATES TABLE
-- Cached shipping rate quotes
-- ============================================
CREATE TABLE IF NOT EXISTS public.dropship_shipping_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
    carrier_id UUID NOT NULL REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
    -- Origin
    origin_postal_code VARCHAR(20) NOT NULL,
    origin_country VARCHAR(2) DEFAULT 'US',
    -- Destination
    destination_postal_code VARCHAR(20) NOT NULL,
    destination_country VARCHAR(2) DEFAULT 'US',
    -- Package
    weight_lbs DECIMAL(10,2) NOT NULL,
    length_in DECIMAL(10,2),
    width_in DECIMAL(10,2),
    height_in DECIMAL(10,2),
    -- Rate
    service_type VARCHAR(100) NOT NULL,
    service_name VARCHAR(255),
    rate_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    estimated_days INTEGER,
    -- Validity
    quoted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    carrier_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_dropship_orders_tenant ON public.dropship_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dropship_orders_customer ON public.dropship_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_dropship_orders_status ON public.dropship_orders(status);
CREATE INDEX IF NOT EXISTS idx_dropship_orders_created ON public.dropship_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dropship_orders_tee_time ON public.dropship_orders(tee_time);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_dropship_order_items_order ON public.dropship_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_dropship_order_items_product ON public.dropship_order_items(product_id);

-- Shipments indexes
CREATE INDEX IF NOT EXISTS idx_dropship_shipments_order ON public.dropship_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_dropship_shipments_tracking ON public.dropship_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_dropship_shipments_status ON public.dropship_shipments(status);
CREATE INDEX IF NOT EXISTS idx_dropship_shipments_carrier ON public.dropship_shipments(carrier_id);

-- Tracking events indexes
CREATE INDEX IF NOT EXISTS idx_dropship_tracking_shipment ON public.dropship_tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_dropship_tracking_timestamp ON public.dropship_tracking_events(event_timestamp DESC);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_dropship_products_tenant ON public.dropship_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dropship_products_category ON public.dropship_products(category);
CREATE INDEX IF NOT EXISTS idx_dropship_products_active ON public.dropship_products(is_active);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_dropship_customers_tenant ON public.dropship_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dropship_customers_user ON public.dropship_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_dropship_customers_email ON public.dropship_customers(email);

-- Rates indexes
CREATE INDEX IF NOT EXISTS idx_dropship_rates_lookup ON public.dropship_shipping_rates(
    origin_postal_code, destination_postal_code, weight_lbs
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- Multi-tenant isolation
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_shipping_rates ENABLE ROW LEVEL SECURITY;

-- Shipping carriers are public read
CREATE POLICY "Carriers are viewable by all authenticated users"
    ON public.shipping_carriers FOR SELECT
    TO authenticated
    USING (true);

-- Carrier credentials - tenant isolation
CREATE POLICY "Carrier credentials tenant isolation"
    ON public.carrier_credentials FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants 
            WHERE user_id = auth.uid()
        )
    );

-- Products - tenant isolation
CREATE POLICY "Products tenant isolation"
    ON public.dropship_products FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants 
            WHERE user_id = auth.uid()
        )
    );

-- Customers - tenant isolation
CREATE POLICY "Customers tenant isolation"
    ON public.dropship_customers FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants 
            WHERE user_id = auth.uid()
        )
    );

-- Orders - tenant isolation
CREATE POLICY "Orders tenant isolation"
    ON public.dropship_orders FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants 
            WHERE user_id = auth.uid()
        )
    );

-- Order items - through order relationship
CREATE POLICY "Order items through order"
    ON public.dropship_order_items FOR ALL
    TO authenticated
    USING (
        order_id IN (
            SELECT id FROM public.dropship_orders 
            WHERE tenant_id IN (
                SELECT tenant_id FROM public.user_tenants 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Shipments - through order relationship
CREATE POLICY "Shipments through order"
    ON public.dropship_shipments FOR ALL
    TO authenticated
    USING (
        order_id IN (
            SELECT id FROM public.dropship_orders 
            WHERE tenant_id IN (
                SELECT tenant_id FROM public.user_tenants 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Tracking events - through shipment relationship
CREATE POLICY "Tracking events through shipment"
    ON public.dropship_tracking_events FOR ALL
    TO authenticated
    USING (
        shipment_id IN (
            SELECT s.id FROM public.dropship_shipments s
            JOIN public.dropship_orders o ON s.order_id = o.id
            WHERE o.tenant_id IN (
                SELECT tenant_id FROM public.user_tenants 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Shipping rates - tenant isolation
CREATE POLICY "Shipping rates tenant isolation"
    ON public.dropship_shipping_rates FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- SEED DATA - SHIPPING CARRIERS
-- ============================================
INSERT INTO public.shipping_carriers (code, name, api_endpoint, api_version, max_weight_lbs) VALUES
    ('fedex', 'FedEx', 'https://apis.fedex.com', 'v1', 150),
    ('ups', 'UPS', 'https://onlinetools.ups.com', 'v1', 150),
    ('usps', 'USPS', 'https://secure.shippingapis.com', 'v3', 70),
    ('dhl', 'DHL Express', 'https://express.api.dhl.com', 'v2', 150)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    api_endpoint = EXCLUDED.api_endpoint,
    api_version = EXCLUDED.api_version,
    max_weight_lbs = EXCLUDED.max_weight_lbs,
    updated_at = NOW();

-- ============================================
-- FUNCTIONS FOR ORDER MANAGEMENT
-- ============================================

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    prefix TEXT := 'CGD';
    year_part TEXT := TO_CHAR(NOW(), 'YYYY');
    sequence_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(order_number FROM 9) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM public.dropship_orders
    WHERE order_number LIKE prefix || '-' || year_part || '-%';
    
    RETURN prefix || '-' || year_part || '-' || LPAD(sequence_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to update order totals
CREATE OR REPLACE FUNCTION update_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.dropship_orders
    SET 
        subtotal = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM public.dropship_order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        ),
        total_weight_lbs = (
            SELECT COALESCE(SUM(weight_lbs * quantity), 0)
            FROM public.dropship_order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    
    -- Recalculate total
    UPDATE public.dropship_orders
    SET total_amount = subtotal + shipping_cost + tax_amount - discount_amount
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for order totals
DROP TRIGGER IF EXISTS trigger_update_order_totals ON public.dropship_order_items;
CREATE TRIGGER trigger_update_order_totals
    AFTER INSERT OR UPDATE OR DELETE ON public.dropship_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_totals();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trigger_carriers_updated ON public.shipping_carriers;
CREATE TRIGGER trigger_carriers_updated
    BEFORE UPDATE ON public.shipping_carriers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_credentials_updated ON public.carrier_credentials;
CREATE TRIGGER trigger_credentials_updated
    BEFORE UPDATE ON public.carrier_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_products_updated ON public.dropship_products;
CREATE TRIGGER trigger_products_updated
    BEFORE UPDATE ON public.dropship_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_customers_updated ON public.dropship_customers;
CREATE TRIGGER trigger_customers_updated
    BEFORE UPDATE ON public.dropship_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_orders_updated ON public.dropship_orders;
CREATE TRIGGER trigger_orders_updated
    BEFORE UPDATE ON public.dropship_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_shipments_updated ON public.dropship_shipments;
CREATE TRIGGER trigger_shipments_updated
    BEFORE UPDATE ON public.dropship_shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Order summary view
CREATE OR REPLACE VIEW public.dropship_order_summary AS
SELECT 
    o.id,
    o.tenant_id,
    o.order_number,
    o.status,
    o.total_amount,
    o.tee_time,
    o.course_name,
    o.created_at,
    c.first_name || ' ' || c.last_name AS customer_name,
    c.email AS customer_email,
    s.tracking_number,
    s.status AS shipment_status,
    sc.name AS carrier_name
FROM public.dropship_orders o
LEFT JOIN public.dropship_customers c ON o.customer_id = c.id
LEFT JOIN public.dropship_shipments s ON o.id = s.order_id
LEFT JOIN public.shipping_carriers sc ON s.carrier_id = sc.id;

-- Grant access to the view
GRANT SELECT ON public.dropship_order_summary TO authenticated;
