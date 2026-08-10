"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Barcode, Boxes, LogOut, ScanLine } from "lucide-react";

const navigation = [
  { href: "/", label: "Inventory", icon: Boxes },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/labels", label: "Labels", icon: Barcode },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="app-header no-print">
      <div className="header-inner">
        <Link className="brand-link" href="/" aria-label="BionicsSCAN inventory">
          <Image src="/logo.png" alt="BionicsSCAN" width={44} height={44} priority />
          <span>
            <strong>BionicsSCAN</strong>
            <small>FRC Inventory</small>
          </span>
        </Link>

        <nav className="main-navigation" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" || pathname.startsWith("/inventory/") : pathname.startsWith(href);
            return (
              <Link className={active ? "nav-link active" : "nav-link"} href={href} key={href}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <form action="/api/auth/logout" method="post">
          <button className="icon-button sign-out-button" type="submit" title="Sign out">
            <LogOut size={18} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
