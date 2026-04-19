"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const linkClass = (href) => {
    const isActive =
      href === "/"
        ? pathname === "/"
        : pathname.startsWith(href);

    return `rounded-full px-4 py-2 text-sm font-semibold transition ${
      isActive
        ? "bg-sky-600 text-white shadow-sm"
        : "text-slate-700 hover:bg-sky-50 hover:text-sky-700"
    }`;
  };

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Image
          src="/images/brand/sea-pals-tcg-logo.png"
          alt="SeaPals Logo"
          width={300}
          height={120}
          className="h-12 w-auto"
        />
      </div>

      <nav className="flex flex-wrap items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-2 py-2 shadow-sm backdrop-blur">
        <Link href="/" className={linkClass("/")}>
          Home
        </Link>

        <Link href="/instructions" className={linkClass("/instructions")}>
          Instructions
        </Link>
        <Link href="/gallery" className={linkClass("/gallery")}>
        Gallery
        </Link>
        <a
          href="/#signup"
          className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
        >
          Join the Crew
        </a>
      </nav>
    </header>
  );
}