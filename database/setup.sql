-- BionicsSCAN database setup
-- Run this file once in the Neon SQL Editor.

BEGIN;

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

-- The seed is idempotent. It preserves existing quantities.
INSERT INTO inventory_items (inventory_type, size, quantity, barcode)
VALUES
  ('BELT_9MM'::inventory_type, 180, 2, 'B9-180'),
  ('BELT_9MM'::inventory_type, 225, 5, 'B9-225'),
  ('BELT_9MM'::inventory_type, 230, 7, 'B9-230'),
  ('BELT_9MM'::inventory_type, 235, 2, 'B9-235'),
  ('BELT_9MM'::inventory_type, 240, 4, 'B9-240'),
  ('BELT_9MM'::inventory_type, 245, 6, 'B9-245'),
  ('BELT_9MM'::inventory_type, 250, 2, 'B9-250'),
  ('BELT_9MM'::inventory_type, 255, 5, 'B9-255'),
  ('BELT_9MM'::inventory_type, 275, 6, 'B9-275'),
  ('BELT_9MM'::inventory_type, 285, 3, 'B9-285'),
  ('BELT_9MM'::inventory_type, 300, 2, 'B9-300'),
  ('BELT_9MM'::inventory_type, 320, 3, 'B9-320'),
  ('BELT_9MM'::inventory_type, 325, 12, 'B9-325'),
  ('BELT_9MM'::inventory_type, 350, 4, 'B9-350'),
  ('BELT_9MM'::inventory_type, 355, 5, 'B9-355'),
  ('BELT_9MM'::inventory_type, 375, 8, 'B9-375'),
  ('BELT_9MM'::inventory_type, 400, 11, 'B9-400'),
  ('BELT_9MM'::inventory_type, 425, 7, 'B9-425'),
  ('BELT_9MM'::inventory_type, 450, 3, 'B9-450'),
  ('BELT_9MM'::inventory_type, 475, 12, 'B9-475'),
  ('BELT_9MM'::inventory_type, 525, 6, 'B9-525'),
  ('BELT_9MM'::inventory_type, 540, 2, 'B9-540'),
  ('BELT_9MM'::inventory_type, 550, 2, 'B9-550'),
  ('BELT_9MM'::inventory_type, 575, 6, 'B9-575'),
  ('BELT_9MM'::inventory_type, 625, 2, 'B9-625'),
  ('BELT_9MM'::inventory_type, 645, 1, 'B9-645'),
  ('BELT_9MM'::inventory_type, 700, 4, 'B9-700'),
  ('BELT_9MM'::inventory_type, 720, 6, 'B9-720'),
  ('BELT_9MM'::inventory_type, 750, 3, 'B9-750'),
  ('BELT_9MM'::inventory_type, 1125, 2, 'B9-1125'),
  ('BELT_9MM'::inventory_type, 1200, 3, 'B9-1200'),
  ('BELT_9MM'::inventory_type, 1250, 4, 'B9-1250'),
  ('BELT_15MM'::inventory_type, 250, 3, 'B15-250'),
  ('BELT_15MM'::inventory_type, 320, 12, 'B15-320'),
  ('BELT_15MM'::inventory_type, 345, 4, 'B15-345'),
  ('BELT_15MM'::inventory_type, 350, 2, 'B15-350'),
  ('BELT_15MM'::inventory_type, 355, 2, 'B15-355'),
  ('BELT_15MM'::inventory_type, 360, 1, 'B15-360'),
  ('BELT_15MM'::inventory_type, 365, 2, 'B15-365'),
  ('BELT_15MM'::inventory_type, 370, 1, 'B15-370'),
  ('BELT_15MM'::inventory_type, 400, 5, 'B15-400'),
  ('BELT_15MM'::inventory_type, 425, 1, 'B15-425'),
  ('BELT_15MM'::inventory_type, 450, 1, 'B15-450'),
  ('BELT_15MM'::inventory_type, 520, 4, 'B15-520'),
  ('BELT_15MM'::inventory_type, 585, 4, 'B15-585'),
  ('BELT_15MM'::inventory_type, 590, 2, 'B15-590'),
  ('BELT_15MM'::inventory_type, 600, 8, 'B15-600'),
  ('BELT_15MM'::inventory_type, 625, 4, 'B15-625'),
  ('BELT_15MM'::inventory_type, 655, 29, 'B15-655'),
  ('BELT_15MM'::inventory_type, 695, 1, 'B15-695'),
  ('BELT_15MM'::inventory_type, 700, 2, 'B15-700'),
  ('BELT_15MM'::inventory_type, 750, 4, 'B15-750'),
  ('BELT_15MM'::inventory_type, 755, 10, 'B15-755'),
  ('BELT_15MM'::inventory_type, 800, 8, 'B15-800'),
  ('BELT_15MM'::inventory_type, 850, 7, 'B15-850'),
  ('BELT_15MM'::inventory_type, 1125, 3, 'B15-1125'),
  ('BELT_15MM'::inventory_type, 1200, 3, 'B15-1200'),
  ('BELT_15MM'::inventory_type, 1250, 3, 'B15-1250'),
  ('BELT_15MM'::inventory_type, 1295, 2, 'B15-1295'),
  ('BELT_15MM'::inventory_type, 1870, 2, 'B15-1870'),
  ('BELT_15MM'::inventory_type, 3120, 5, 'B15-3120'),
  ('GEAR'::inventory_type, 84, 3, 'GR-84'),
  ('GEAR'::inventory_type, 80, 2, 'GR-80'),
  ('GEAR'::inventory_type, 76, 2, 'GR-76'),
  ('GEAR'::inventory_type, 72, 10, 'GR-72'),
  ('GEAR'::inventory_type, 64, 1, 'GR-64'),
  ('GEAR'::inventory_type, 60, 1, 'GR-60'),
  ('GEAR'::inventory_type, 56, 1, 'GR-56'),
  ('GEAR'::inventory_type, 54, 2, 'GR-54'),
  ('GEAR'::inventory_type, 52, 3, 'GR-52'),
  ('GEAR'::inventory_type, 50, 3, 'GR-50'),
  ('GEAR'::inventory_type, 48, 14, 'GR-48'),
  ('GEAR'::inventory_type, 45, 2, 'GR-45'),
  ('GEAR'::inventory_type, 44, 4, 'GR-44'),
  ('GEAR'::inventory_type, 42, 2, 'GR-42'),
  ('GEAR'::inventory_type, 30, 4, 'GR-30'),
  ('GEAR'::inventory_type, 26, 2, 'GR-26'),
  ('GEAR'::inventory_type, 24, 6, 'GR-24'),
  ('GEAR'::inventory_type, 22, 6, 'GR-22'),
  ('SPROCKET'::inventory_type, 16, 12, 'SP-16'),
  ('SPROCKET'::inventory_type, 24, 4, 'SP-24'),
  ('SPROCKET'::inventory_type, 32, 7, 'SP-32')
ON CONFLICT (inventory_type, size)
DO UPDATE SET barcode = EXCLUDED.barcode;

COMMIT;
