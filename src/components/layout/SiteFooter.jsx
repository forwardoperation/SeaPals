"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SEAPALS_OPERATOR } from "@/lib/legalPrivacy.mjs";

export default function SiteFooter() {
  const pathname = usePathname();
  const isAccountGameRoute =
    pathname.startsWith("/adventure") || pathname.startsWith("/auth");

  if (isAccountGameRoute) return null;

  return (
    <footer className="mt-14 border-t border-cyan-200/80 py-8 text-sm text-slate-600">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <p className="max-w-xl leading-6">
          <strong className="text-slate-800">SeaPals TCG</strong> is operated by{" "}
          {SEAPALS_OPERATOR.legalName} in Pennsylvania, USA.
        </p>
        <nav
          aria-label="Store, game, privacy, terms, and contact"
          className="flex flex-wrap items-center gap-x-5 gap-y-3 font-bold"
        >
          <Link
            href="/store"
            className="rounded text-cyan-800 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
          >
            Store
          </Link>
          <Link
            href="/simulator"
            className="rounded text-cyan-800 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
          >
            Try a Deck
          </Link>
          <Link
            href="/privacy"
            className="rounded text-cyan-800 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
          >
            Privacy for Families
          </Link>
          <Link
            href="/terms"
            className="rounded text-cyan-800 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
          >
            Terms of Use
          </Link>
          <a
            href={`mailto:${SEAPALS_OPERATOR.privacyEmail}`}
            className="rounded text-cyan-800 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
          >
            Contact
          </a>
        </nav>
      </div>
      <p className="mt-5 text-xs text-slate-500">
        © 2026 {SEAPALS_OPERATOR.legalName}. All rights reserved.
      </p>
    </footer>
  );
}
