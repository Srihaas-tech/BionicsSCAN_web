CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE inventory_type AS ENUM ('BELT_9MM', 'BELT_15MM', 'GEAR', 'SPROCKET');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_type inventory_type NOT NULL,
  size integer NOT NULL CHECK (size > 0),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  barcode varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_type_size_unique UNIQUE (inventory_type, size),
  CONSTRAINT inventory_items_barcode_unique UNIQUE (barcode)
);

CREATE INDEX IF NOT EXISTS inventory_items_type_index
  ON inventory_items (inventory_type);

CREATE TABLE IF NOT EXISTS inventory_events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  action varchar(16) NOT NULL CHECK (action IN ('CHECKIN', 'CHECKOUT')),
  delta integer NOT NULL CHECK (delta IN (-1, 1)),
  before_quantity integer NOT NULL CHECK (before_quantity >= 0),
  after_quantity integer NOT NULL CHECK (after_quantity >= 0),
  actor varchar(100) NOT NULL DEFAULT 'team',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_events_item_time_index
  ON inventory_events (item_id, created_at DESC);
