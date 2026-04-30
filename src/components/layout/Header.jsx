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

    return `flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-center transition-all duration-200 ${
      isActive
        ? "bg-sky-600 text-white shadow-sm"
        : "text-slate-700 hover:bg-sky-50 hover:text-sky-700"
    }`;
  };

  return (
    <header className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Image
          src="/images/brand/sea-pals-tcg-logo.png"
          alt="SeaPals Logo"
          width={300}
          height={120}
          className="h-12 w-auto"
        />
      </div>

      <nav className="grid w-full grid-cols-2 gap-3 rounded-3xl border border-cyan-200 bg-white/90 p-4 shadow-sm backdrop-blur md:flex md:w-auto md:flex-wrap md:items-center md:gap-2 md:rounded-full md:px-2 md:py-2">
        <Link href="/" className={linkClass("/")}>
          Home
        </Link>

        <Link href="/instructions" className={linkClass("/instructions")}>
          Instructions
        </Link>

        <Link href="/gallery" className={linkClass("/gallery")}>
          Gallery
        </Link>

        <Link href="/tournaments" className={linkClass("/tournaments")}>
          Tournaments
        </Link>

        <a
          href="/#signup"
          className="flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-center text-slate-700 transition-all duration-200 hover:bg-sky-50 hover:text-sky-700"
        >
          Join the Crew
        </a>
      </nav>
    </header>
  );
}
