import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Barcode,
  Clock3,
  Minus,
  PackageCheck,
  Plus,
} from "lucide-react";

import { QuantityControls } from "@/components/quantity-controls";
import {
  getBionicInventoryItem,
  listBionicInventoryEvents,
} from "@/src/lib/bionic-inventory";
import {
  formatItemSize,
  formatItemTitle,
  getStockState,
  INVENTORY_META,
} from "@/src/lib/inventory";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getBionicInventoryItem(id);
  return {
    title: item
      ? formatItemTitle(item.inventoryType, item.size)
      : "Inventory item",
  };
}

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getBionicInventoryItem(id);

  if (!item) {
    notFound();
  }

  const events = await listBionicInventoryEvents(item);
  const metadata = INVENTORY_META[item.inventoryType];
  const stock = getStockState(item.quantity);

  return (
    <main className="page-shell detail-page" id="main-content">
      <Link className="back-link no-print" href="/">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to inventory
      </Link>

      <section className="detail-hero">
        <div>
          <div className="eyebrow">{metadata.label}</div>
          <h1>{formatItemTitle(item.inventoryType, item.size)}</h1>
          <span className={`stock-badge ${stock.tone}`}>{stock.label}</span>
        </div>
        {/* The authenticated barcode endpoint requires the browser session cookie. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="detail-barcode"
          src={`/api/barcode?code=${encodeURIComponent(item.barcode)}`}
          alt={`Barcode ${item.barcode}`}
        />
      </section>

      <div className="detail-grid">
        <section className="detail-card">
          <div className="section-title">
            <PackageCheck size={21} aria-hidden="true" />
            <h2>Item information</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Category</dt>
              <dd>{metadata.label}</dd>
            </div>
            <div>
              <dt>{metadata.sizeField}</dt>
              <dd>{formatItemSize(item.inventoryType, item.size)}</dd>
            </div>
            <div>
              <dt>Barcode</dt>
              <dd>
                <code>{item.barcode}</code>
              </dd>
            </div>
            <div>
              <dt>Data source</dt>
              <dd>Bionic Inventory</dd>
            </div>
          </dl>
          <QuantityControls initialItem={item} />
        </section>

        <section className="detail-card activity-card">
          <div className="section-title">
            <Clock3 size={21} aria-hidden="true" />
            <h2>Recent activity</h2>
          </div>
          {events.length === 0 ? (
            <div className="activity-empty">
              <Barcode size={28} aria-hidden="true" />
              <p>No check-in or checkout activity exists.</p>
            </div>
          ) : (
            <ol className="activity-list">
              {events.map((event) => (
                <li key={event.id}>
                  <span
                    className={
                      event.delta > 0
                        ? "activity-icon positive"
                        : "activity-icon negative"
                    }
                  >
                    {event.delta > 0 ? (
                      <Plus size={16} />
                    ) : (
                      <Minus size={16} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {event.delta > 0 ? "Checked in" : "Checked out"}
                    </strong>
                    <small>
                      {event.beforeQuantity} → {event.afterQuantity}
                    </small>
                  </div>
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
