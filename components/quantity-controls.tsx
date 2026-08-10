"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import type { InventoryItem } from "@/src/types/inventory";

export function QuantityControls({ initialItem }: { initialItem: InventoryItem }) {
  const router = useRouter();
  const [item, setItem] = useState(initialItem);
  const [pendingDelta, setPendingDelta] = useState<1 | -1 | null>(null);
  const [message, setMessage] = useState<string | null>(null);


  async function adjust(delta: 1 | -1) {
    setPendingDelta(delta);
    setMessage(null);
    try {
      const response = await fetch(`/api/items/${item.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const data = (await response.json()) as {
        item?: InventoryItem;
        error?: { message?: string };
      };
      if (!response.ok || !data.item) {
        throw new Error(data.error?.message || "The quantity update failed.");
      }
      setItem(data.item);
      setMessage(delta === 1 ? "Item checked in." : "Item checked out.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The quantity update failed.");
    } finally {
      setPendingDelta(null);
    }
  }

  return (
    <section className="quantity-panel" aria-labelledby="quantity-title">
      <div>
        <span id="quantity-title">Current quantity</span>
        <strong aria-live="polite">{item.quantity}</strong>
      </div>
      <div className="quantity-buttons">
        <button
          className="button button-danger"
          type="button"
          disabled={item.quantity === 0 || pendingDelta !== null}
          onClick={() => void adjust(-1)}
        >
          <Minus size={19} aria-hidden="true" />
          {pendingDelta === -1 ? "Checking out" : "Check out"}
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={pendingDelta !== null}
          onClick={() => void adjust(1)}
        >
          <Plus size={19} aria-hidden="true" />
          {pendingDelta === 1 ? "Checking in" : "Check in"}
        </button>
      </div>
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </section>
  );
}
