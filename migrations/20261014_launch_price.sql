-- Lower launch base price; only rewrites rows still at the old default.
ALTER TABLE pricing_config ALTER COLUMN base_price SET DEFAULT 9.00;
UPDATE pricing_config SET base_price = 9.00, updated_at = NOW() WHERE base_price = 19.00;
