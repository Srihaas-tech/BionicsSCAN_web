import type { InventoryType } from "../types/inventory";
import { INVENTORY_TYPES } from "../types/inventory";

export interface InventoryMetadata {
  label: string;
  shortLabel: string;
  singular: string;
  unit: "mm" | "T";
  sizeField: "Length" | "Teeth";
  barcodePrefix: string;
}

export const INVENTORY_META: Record<InventoryType, InventoryMetadata> = {
  BELT_9MM: {
    label: "9mm Belts",
    shortLabel: "9mm",
    singular: "9mm Belt",
    unit: "mm",
    sizeField: "Length",
    barcodePrefix: "B9",
  },
  BELT_15MM: {
    label: "15mm Belts",
    shortLabel: "15mm",
    singular: "15mm Belt",
    unit: "mm",
    sizeField: "Length",
    barcodePrefix: "B15",
  },
  GEAR: {
    label: "Gears",
    shortLabel: "Gears",
    singular: "Gear",
    unit: "T",
    sizeField: "Teeth",
    barcodePrefix: "GR",
  },
  SPROCKET: {
    label: "Sprockets",
    shortLabel: "Sprockets",
    singular: "Sprocket",
    unit: "T",
    sizeField: "Teeth",
    barcodePrefix: "SP",
  },
};

export function isInventoryType(value: unknown): value is InventoryType {
  return (
    typeof value === "string" &&
    INVENTORY_TYPES.includes(value as InventoryType)
  );
}

export function normalizeBarcode(value: string): string {
  return value.trim().toUpperCase();
}

export function formatItemSize(
  type: InventoryType,
  size: number,
): string {
  return `${size}${INVENTORY_META[type].unit}`;
}

export function formatItemTitle(
  type: InventoryType,
  size: number,
): string {
  return `${INVENTORY_META[type].singular} ${formatItemSize(type, size)}`;
}

export function getStockState(quantity: number): {
  label: "Available" | "Low stock" | "Out of stock";
  tone: "good" | "warning" | "danger";
} {
  if (quantity <= 0) {
    return {
      label: "Out of stock",
      tone: "danger",
    };
  }

  if (quantity <= 2) {
    return {
      label: "Low stock",
      tone: "warning",
    };
  }

  return {
    label: "Available",
    tone: "good",
  };
}

export function isValidQuantityDelta(
  value: unknown,
): value is 1 | -1 {
  return value === 1 || value === -1;
}