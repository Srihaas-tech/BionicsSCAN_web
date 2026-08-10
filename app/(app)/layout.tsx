import { AppHeader } from "@/components/app-header";
import { requirePageSession } from "@/src/lib/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();

  return (
    <div className="application">
      <AppHeader />
      {children}
    </div>
  );
}
