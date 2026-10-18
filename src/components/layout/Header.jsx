"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./Header.module.css";

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const toggleRef = useRef(null);
  const navRef = useRef(null);
  const isAccountGameRoute =
    pathname.startsWith("/adventure") || pathname.startsWith("/auth")
    || pathname.startsWith("/dev/reefbound/play");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => {
      setMenuOpen(false);
      if (!desktop.matches && navRef.current?.contains(document.activeElement)) {
        toggleRef.current?.focus();
      }
    };
    desktop.addEventListener("change", handleResize);
    return () => desktop.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const handlePointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

  if (isAccountGameRoute) return null;

  return (
    <header
      ref={headerRef}
      className={styles.header}
      onBlurCapture={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setMenuOpen(false);
        }
      }}
    >
      <Link href="/" aria-label="SeaRealm home" className={styles.brand} onClick={() => setMenuOpen(false)}>
        <Image
          src="/images/brand/searealm-tcg-logo.png"
          alt="SeaRealm Logo"
          width={1500}
          height={421}
          className={styles.logo}
        />
      </Link>

      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-controls="primary-navigation"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className={styles.menuIcon} aria-hidden="true" data-open={menuOpen}>
          <span /><span /><span />
        </span>
        <span>Menu</span>
      </button>

      <nav
        ref={navRef}
        id="primary-navigation"
        aria-label="Primary navigation"
        className={styles.navigation}
        data-open={menuOpen}
      >
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Home
        </Link>

        <Link href="/instructions" aria-current={pathname.startsWith("/instructions") ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Instructions
        </Link>

        <Link href="/gallery" aria-current={pathname.startsWith("/gallery") ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Gallery
        </Link>

        <Link href="/set-list" aria-current={pathname.startsWith("/set-list") ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Set List
        </Link>

        <Link href="/encyclopedia" aria-current={pathname.startsWith("/encyclopedia") ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Learn
        </Link>

        <Link href="/decks" aria-current={pathname.startsWith("/decks") ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Decks
        </Link>

        <Link href="/store" aria-current={pathname.startsWith("/store") ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Store
        </Link>

        <Link href="/companion" aria-current={pathname.startsWith("/companion") ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Tools
        </Link>

        <Link href="/surveys" aria-current={pathname.startsWith("/surveys") ? "page" : undefined} className={styles.link} onClick={() => setMenuOpen(false)}>
          Survey
        </Link>

        <a href="/#signup" className={`${styles.link} ${styles.join}`} onClick={() => setMenuOpen(false)}>
          Join the Crew
        </a>
      </nav>
    </header>
  );
}
