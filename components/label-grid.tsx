"use client";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import type { InventoryItem, InventoryType } from "@/src/types/inventory";
import { INVENTORY_TYPES } from "@/src/types/inventory";
import { formatItemSize, INVENTORY_META } from "@/src/lib/inventory";

export function LabelGrid({ items }: { items: InventoryItem[] }) {
  const [selectedType, setSelectedType] = useState<InventoryType>("BELT_9MM");
  const visibleItems = useMemo(
    () => items.filter((item) => item.inventoryType === selectedType),
    [items, selectedType],
  );
  const metadata = INVENTORY_META[selectedType];

  return (
    <>
      <div className="labels-toolbar no-print">
        <div className="category-tabs" role="tablist" aria-label="Label categories">
          {INVENTORY_TYPES.map((type) => (
            <button
              className={selectedType === type ? "category-tab active" : "category-tab"}
              type="button"
              role="tab"
              aria-selected={selectedType === type}
              onClick={() => setSelectedType(type)}
              key={type}
            >
              {INVENTORY_META[type].shortLabel}
            </button>
          ))}
        </div>
        <div className="heading-actions">
          <button className="button button-secondary" type="button" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            Print
          </button>
          <a className="button button-primary" href={`/api/labels.pdf?type=${selectedType}`}>
            <Download size={18} aria-hidden="true" />
            Download PDF
          </a>
        </div>
      </div>

      <div className="print-title">
        <h1>BionicsSCAN — {metadata.label}</h1>
      </div>
      <section className="label-grid print-area" aria-label={`${metadata.label} barcode labels`}>
        {visibleItems.map((item) => (
          <article className="barcode-label" key={item.id}>
            <div className="label-heading">
              <strong>{metadata.singular}: {formatItemSize(item.inventoryType, item.size)}</strong>
              <span>Qty {item.quantity}</span>
            </div>
            {/* The authenticated barcode endpoint requires the browser session cookie. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/barcode?code=${encodeURIComponent(item.barcode)}`}
              alt={`Barcode ${item.barcode}`}
            />
            <code>{item.barcode}</code>
          </article>
        ))}
      </section>
    </>
  );
}
