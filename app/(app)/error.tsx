"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="centered-page" id="main-content">
      <div className="empty-card">
        <AlertTriangle size={42} aria-hidden="true" />
        <h1>Something went wrong</h1>
        <p>Verify the database settings, then retry the request.</p>
        <button className="button button-primary" type="button" onClick={reset}>
          <RotateCcw size={18} aria-hidden="true" />
          Retry
        </button>
      </div>
    </main>
  );
}
