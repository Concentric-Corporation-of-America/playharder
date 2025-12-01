-- Pricing Configuration Tables for PlayHarder

-- Main pricing configuration table
CREATE TABLE IF NOT EXISTS dropship_pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promo codes table
CREATE TABLE IF NOT EXISTS dropship_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promo code usage tracking
CREATE TABLE IF NOT EXISTS dropship_promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES dropship_promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID,
  discount_applied DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dynamic pricing rules (distance-based, time-based, etc.)
CREATE TABLE IF NOT EXISTS dropship_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('distance', 'weight', 'service_level', 'time_of_year', 'partner')),
  conditions JSONB NOT NULL,
  markup_type TEXT NOT NULL CHECK (markup_type IN ('percentage', 'fixed_amount')),
  markup_value DECIMAL(10,2) NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insurance options table
CREATE TABLE IF NOT EXISTS dropship_insurance_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coverage_amount DECIMAL(10,2) NOT NULL,
  premium_percentage DECIMAL(5,4) DEFAULT 0,
  premium_fixed DECIMAL(10,2) DEFAULT 0,
  is_complimentary BOOLEAN DEFAULT false,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dropship_pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropship_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropship_promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropship_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropship_insurance_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow public read for pricing config (needed for frontend)
CREATE POLICY "Allow public read on pricing config" ON dropship_pricing_config FOR SELECT USING (true);
CREATE POLICY "Allow public read on promo codes" ON dropship_promo_codes FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public read on pricing rules" ON dropship_pricing_rules FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public read on insurance options" ON dropship_insurance_options FOR SELECT USING (is_active = true);

-- Users can only see their own promo code usage
CREATE POLICY "Users can view own promo usage" ON dropship_promo_code_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own promo usage" ON dropship_promo_code_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert default pricing configuration
INSERT INTO dropship_pricing_config (config_key, config_value, description) VALUES
('base_markup_per_way', '{"amount": 25, "type": "fixed"}', 'Base markup per shipment (one-way) - $25 per way, $50 roundtrip'),
('show_price_breakdown', '{"enabled": true}', 'Show carrier cost + service fee breakdown to customers'),
('insurance_messaging', '{"enabled": true, "default_coverage": 1000, "message": "Includes $1,000 complimentary gear protection"}', 'Insurance messaging configuration')
ON CONFLICT (config_key) DO NOTHING;

-- Insert default insurance options
INSERT INTO dropship_insurance_options (name, coverage_amount, premium_percentage, premium_fixed, is_complimentary, description) VALUES
('Basic Protection', 1000, 0, 0, true, 'Complimentary $1,000 coverage included with every shipment'),
('Enhanced Protection', 3000, 0.02, 0, false, 'Upgrade to $3,000 coverage for 2% of declared value'),
('Premium Protection', 7500, 0.025, 0, false, 'Maximum $7,500 coverage for 2.5% of declared value')
ON CONFLICT DO NOTHING;

-- Insert default pricing rules for dynamic pricing
INSERT INTO dropship_pricing_rules (rule_name, rule_type, conditions, markup_type, markup_value, priority) VALUES
('Short Distance Discount', 'distance', '{"max_miles": 100}', 'fixed_amount', 20, 10),
('Medium Distance Standard', 'distance', '{"min_miles": 100, "max_miles": 500}', 'fixed_amount', 25, 5),
('Long Distance Premium', 'distance', '{"min_miles": 500}', 'fixed_amount', 30, 5),
('Express Service Premium', 'service_level', '{"service_types": ["overnight", "priority", "express"]}', 'percentage', 5, 3)
ON CONFLICT DO NOTHING;

-- Insert sample promo codes
INSERT INTO dropship_promo_codes (code, discount_type, discount_value, description, valid_until) VALUES
('WELCOME10', 'percentage', 10, 'Welcome discount - 10% off first order', NOW() + INTERVAL '1 year'),
('GOLF25', 'fixed_amount', 25, '$25 off your shipment', NOW() + INTERVAL '6 months')
ON CONFLICT (code) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON dropship_promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON dropship_promo_codes(is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON dropship_pricing_rules(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_pricing_config_key ON dropship_pricing_config(config_key);
