"use client";

import { useMemo, useRef, useState } from "react";

export default function Faq({ questions }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredQuestions = useMemo(() => {
    if (!normalizedQuery) return questions;

    return questions.filter((item) =>
      `${item.question} ${item.answer}`.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, questions]);

  return (
    <div>
      <label className="block" htmlFor="rules-search">
        <span className="sr-only">Search frequently asked questions</span>
        <span className="flex items-center gap-3 rounded-2xl border border-cyan-200/30 bg-cyan-950/25 px-4 py-3 focus-within:border-cyan-200 focus-within:ring-4 focus-within:ring-cyan-300/15">
          <span aria-hidden="true" className="text-xl text-cyan-200">
            ⌕
          </span>
          <input
            ref={inputRef}
            id="rules-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search: ties, RP, slots, empty deck…"
            className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-cyan-100/60"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className="rounded-full px-3 py-1 text-xs font-bold text-cyan-100 hover:bg-cyan-900/30"
            >
              Clear
            </button>
          ) : null}
        </span>
      </label>

      <p aria-live="polite" className="mt-3 text-sm text-cyan-100">
        {filteredQuestions.length === questions.length
          ? `${questions.length} common questions`
          : `${filteredQuestions.length} matching question${filteredQuestions.length === 1 ? "" : "s"}`}
      </p>

      <div className="mt-5 space-y-3">
        {filteredQuestions.map((item) => (
          <details
            key={item.question}
            className="group border-b border-white/15 open:border-cyan-200/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold text-white [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-bold md:text-lg">{item.question}</h3>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-950/25 text-xl text-cyan-100 transition group-open:rotate-45 group-open:bg-cyan-700/40 group-open:text-white"
              >
                +
              </span>
            </summary>
            <p className="border-t border-white/10 px-5 py-4 text-sm leading-7 text-cyan-100/90 md:text-base">
              {item.answer}
            </p>
          </details>
        ))}

        {!filteredQuestions.length ? (
          <div className="border-y border-dashed border-cyan-200/30 py-6 text-center">
            <p className="font-bold text-white">No exact match yet.</p>
            <p className="mt-2 text-sm leading-6 text-cyan-100/90">
              Try a shorter word, or ask Finn using the chat button in the bottom-right corner.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
