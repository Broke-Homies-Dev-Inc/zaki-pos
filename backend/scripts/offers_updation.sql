BEGIN;

-- =========================================================
-- offers: make offers flexible (item / combo / order)
-- =========================================================

ALTER TABLE offers
ADD COLUMN offer_type TEXT,                -- item | combo | order
ADD COLUMN discount_type TEXT,             -- percent | flat | fixed_price | bogo
ADD COLUMN discount_value NUMERIC(10,2),   -- value for percent / flat / fixed price
ADD COLUMN priority INTEGER DEFAULT 100,   -- lower = higher priority
ADD COLUMN is_stackable BOOLEAN DEFAULT false, -- combos must never stack
ADD COLUMN start_time TIMESTAMPTZ,          -- offer start time
ADD COLUMN end_time TIMESTAMPTZ;            -- offer end time


-- ensure combos are explicitly non-stackable
UPDATE offers
SET is_stackable = false
WHERE offer_type = 'COMBO';


-- =========================================================
-- combos: first-class combo entity (acts like a product)
-- =========================================================

CREATE TABLE combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id INTEGER NOT NULL REFERENCES offers(id), -- linked offer (offer_type = combo)
  name TEXT NOT NULL,                              -- combo display name
  fixed_price NUMERIC(10,2) NOT NULL,              -- final combo price
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =========================================================
-- combo_items: items included in a combo
-- =========================================================

CREATE TABLE combo_items (
  combo_id UUID NOT NULL REFERENCES combos(id),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL,
  PRIMARY KEY (combo_id, menu_item_id)
);


-- =========================================================
-- orders: track if a combo is applied
-- =========================================================

ALTER TABLE orders
ADD COLUMN applied_combo_id UUID REFERENCES combos(id), -- only one combo allowed
ADD COLUMN has_combo BOOLEAN DEFAULT false;              -- backend-controlled guard flag


-- mark existing orders correctly (safe backfill)
UPDATE orders
SET has_combo = true
WHERE applied_combo_id IS NOT NULL;


-- prevent more than one combo per order (no combo stacking)
CREATE UNIQUE INDEX unique_combo_per_order
ON orders (id)
WHERE applied_combo_id IS NOT NULL;


-- =========================================================
-- order_items: explicitly mark discount source
-- =========================================================

ALTER TABLE order_items
ADD COLUMN applied_offer_source TEXT; -- item | combo | order


-- =========================================================
-- item offers: deprecate legacy table safely
-- =========================================================

ALTER TABLE item_offers
RENAME TO item_offers_legacy;


-- =========================================================
-- indexing for active / limited-time offers
-- =========================================================

CREATE INDEX idx_offers_active_window
ON offers (active, start_time, end_time);


COMMIT;
