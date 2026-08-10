import type { Metadata } from "next";
import { LabelGrid } from "@/components/label-grid";
import { listInventoryItems } from "@/src/db/queries";

export const metadata: Metadata = { title: "Barcode labels" };
export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const items = await listInventoryItems();
  return (
    <main className="page-shell labels-page" id="main-content">
      <section className="page-heading no-print">
        <div>
          <div className="eyebrow">Code 128 labels</div>
          <h1>Barcode labels</h1>
          <p>Preview, print, or download an A4 PDF for one inventory category.</p>
        </div>
      </section>
      <LabelGrid items={items} />
    </main>
  );
}
