"use client";

import { useEffect, useMemo, useState } from "react";

const groups = [
  {
    label: "Start playing",
    items: [
      { id: "start-here", label: "Start here" },
      { id: "goal", label: "How to win" },
      { id: "setup", label: "Set up the table" },
      { id: "turn", label: "Take a turn" },
      { id: "first-round", label: "Play the first round" },
    ],
  },
  {
    label: "Learn the cards",
    items: [
      { id: "read-a-card", label: "Read a card" },
      { id: "slots", label: "Place cards" },
      { id: "combat", label: "Attack & defend" },
    ],
  },
  {
    label: "Look it up",
    items: [
      { id: "advanced", label: "Complete rules" },
      { id: "glossary", label: "Glossary" },
      { id: "faq", label: "FAQ" },
    ],
  },
];

const items = groups.flatMap((group) => group.items);

function NavLink({ item, active, onNavigate, compact = false }) {
  const isActive = active === item.id;

  return (
    <a
      href={`#${item.id}`}
      onClick={() => onNavigate(item.id)}
      aria-current={isActive ? "location" : undefined}
      className={`group flex items-center gap-3 rounded-xl transition ${
        compact ? "px-3 py-2.5" : "px-3 py-2"
      } ${
        isActive
          ? "bg-cyan-700 font-bold text-white shadow-sm"
          : "font-medium text-slate-600 hover:bg-cyan-50 hover:text-cyan-800"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isActive ? "bg-amber-300" : "bg-cyan-300 group-hover:bg-cyan-600"
        }`}
      />
      <span>{item.label}</span>
    </a>
  );
}

export default function InstructionsNav() {
  const [active, setActive] = useState("start-here");
  const activeLabel = useMemo(
    () => items.find((item) => item.id === active)?.label ?? "Start here",
    [active],
  );

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);

    const updateFromHash = () => {
      const id = window.location.hash.slice(1);
      if (items.some((item) => item.id === id)) setActive(id);
    };

    updateFromHash();

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-16% 0px -68% 0px", threshold: [0, 0.1, 0.35] },
    );

    sections.forEach((section) => observer.observe(section));
    window.addEventListener("hashchange", updateFromHash);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", updateFromHash);
    };
  }, []);

  const handleNavigate = (id) => {
    setActive(id);
    document.querySelector("[data-mobile-instructions-nav]")?.removeAttribute("open");
  };

  return (
    <>
      <div className="sticky top-3 z-30 lg:hidden">
        <details
          data-rules-ignore
          data-mobile-instructions-nav
          className="group max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-cyan-200 bg-white/95 shadow-lg backdrop-blur"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-800">
                ≡
              </span>
              <span className="truncate">Jump to: {activeLabel}</span>
            </span>
            <span
              aria-hidden="true"
              className="text-cyan-700 transition group-open:rotate-180"
            >
              ↓
            </span>
          </summary>
          <nav
            data-rules-ignore
            aria-label="Instructions sections"
            className="border-t border-cyan-100 p-2"
          >
            <div className="grid gap-1 sm:grid-cols-2">
              {items.map((item) => (
                <NavLink
                  key={item.id}
                  item={item}
                  active={active}
                  onNavigate={handleNavigate}
                  compact
                />
              ))}
            </div>
          </nav>
        </details>
      </div>

      <aside data-rules-ignore className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-3xl border border-cyan-100 bg-white/90 p-4 shadow-sm backdrop-blur">
          <p className="px-3 text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">
            On this page
          </p>
          <nav
            data-rules-ignore
            aria-label="Instructions sections"
            className="mt-4 space-y-5"
          >
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {group.label}
                </p>
                <div className="mt-1 space-y-0.5 text-sm">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.id}
                      item={item}
                      active={active}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              Turn reminder
            </p>
            <p className="mt-2 text-sm font-bold leading-6">
              Choose → Collect → Build → Attack
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
