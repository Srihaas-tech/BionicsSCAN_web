import type { Metadata } from "next";
import { InventoryDashboard } from "@/components/inventory-dashboard";
import { listInventoryItems } from "@/src/db/queries";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  try {
    const items = await listInventoryItems();
    return <InventoryDashboard initialItems={items} databaseError={false} />;
  } catch (error) {
    console.error("Initial inventory load failed", error);
    return <InventoryDashboard initialItems={[]} databaseError />;
  }
}
