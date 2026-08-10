export const INVENTORY_TYPES = [
  "BELT_9MM",
  "BELT_15MM",
  "GEAR",
  "SPROCKET",
] as const;

export type InventoryType = (typeof INVENTORY_TYPES)[number];

export interface InventoryItem {
  id: string;
  inventoryType: InventoryType;
  size: number;
  quantity: number;
  barcode: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryEvent {
  id: number;
  itemId: string;
  action: "CHECKIN" | "CHECKOUT";
  delta: 1 | -1;
  beforeQuantity: number;
  afterQuantity: number;
  actor: string;
  createdAt: string;
}

export type SyncStatus = "online" | "syncing" | "offline";
