import Link from "next/link";

export default function NotFound() {
  return (
    <main className="centered-page" id="main-content">
      <div className="empty-card">
        <span className="error-code">404</span>
        <h1>Item not found</h1>
        <p>The requested inventory item does not exist.</p>
        <Link className="button button-primary" href="/">
          Return to inventory
        </Link>
      </div>
    </main>
  );
}
