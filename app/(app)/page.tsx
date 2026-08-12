import type { Metadata } from "next";

import { InventoryDashboard } from "@/components/inventory-dashboard";
import { listInventoryItems } from "@/src/db/queries";
import { syncSheetToDatabase } from "@/src/lib/inventory-sync";

export const metadata: Metadata = {
  title: "Inventory",
};

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  try {
    try {
      await syncSheetToDatabase(
        "BELT_9MM",
      );
    } catch (error) {
      console.error(
        "Initial spreadsheet sync failed",
        error,
      );
    }

    const items =
      await listInventoryItems();

    return (
      <InventoryDashboard
        initialItems={items}
        databaseError={false}
      />
    );
  } catch (error) {
    console.error(
      "Initial inventory load failed",
      error,
    );

    return (
      <InventoryDashboard
        initialItems={[]}
        databaseError
      />
    );
  }
}