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
    <header className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
      <Link
        href="/"
        aria-label="SeaPals home"
        className="rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
      >
        <Image
          src="/images/brand/sea-pals-tcg-logo.png"
          alt="SeaPals Logo"
          width={300}
          height={120}
          className="h-12 w-auto"
        />
      </Link>

      <nav
        aria-label="Primary navigation"
        className="grid w-full grid-cols-2 gap-2 rounded-3xl border border-cyan-200 bg-white/90 p-2.5 shadow-sm backdrop-blur md:flex md:w-auto md:flex-wrap md:items-center md:rounded-full"
      >
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={linkClass("/")}>
          Home
        </Link>

        <Link href="/instructions" aria-current={pathname.startsWith("/instructions") ? "page" : undefined} className={linkClass("/instructions")}>
          Instructions
        </Link>

        <Link href="/gallery" aria-current={pathname.startsWith("/gallery") ? "page" : undefined} className={linkClass("/gallery")}>
          Gallery
        </Link>

        <Link href="/encyclopedia" aria-current={pathname.startsWith("/encyclopedia") ? "page" : undefined} className={linkClass("/encyclopedia")}>
          Learn
        </Link>

        <Link href="/decks" aria-current={pathname.startsWith("/decks") ? "page" : undefined} className={linkClass("/decks")}>
          Decks
        </Link>

        <Link href="/tournaments" aria-current={pathname.startsWith("/tournaments") ? "page" : undefined} className={linkClass("/tournaments")}>
          Tournaments
        </Link>

        <Link href="/companion" aria-current={pathname.startsWith("/companion") ? "page" : undefined} className={linkClass("/companion")}>
          Tools
        </Link>

        <Link href="/surveys" aria-current={pathname.startsWith("/surveys") ? "page" : undefined} className={linkClass("/surveys")}>
          Survey
        </Link>

        <a
          href="/#signup"
          className="flex items-center justify-center rounded-full bg-[#f7c948] px-4 py-2.5 text-center text-sm font-bold text-[#073d58] transition-all duration-200 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
        >
          Join the Crew
        </a>
      </nav>
    </header>
  );
}
