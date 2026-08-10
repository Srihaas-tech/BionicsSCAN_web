import type { Metadata } from "next";
import { ScannerClient } from "@/components/scanner-client";

export const metadata: Metadata = { title: "Scan barcode" };

export default function ScanPage() {
  return (
    <main className="page-shell" id="main-content">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Camera scanner</div>
          <h1>Scan a barcode</h1>
          <p>Vercel supplies HTTPS, which allows supported browsers to open the camera.</p>
        </div>
      </section>
      <ScannerClient />
    </main>
  );
}
