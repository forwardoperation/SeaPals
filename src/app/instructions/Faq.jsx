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
        <span className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-white px-4 py-3 shadow-sm focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-100">
          <span aria-hidden="true" className="text-xl text-cyan-700">
            ⌕
          </span>
          <input
            ref={inputRef}
            id="rules-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search: ties, RP, slots, empty deck…"
            className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className="rounded-full px-3 py-1 text-xs font-bold text-cyan-800 hover:bg-cyan-50"
            >
              Clear
            </button>
          ) : null}
        </span>
      </label>

      <p aria-live="polite" className="mt-3 text-sm text-slate-500">
        {filteredQuestions.length === questions.length
          ? `${questions.length} common questions`
          : `${filteredQuestions.length} matching question${filteredQuestions.length === 1 ? "" : "s"}`}
      </p>

      <div className="mt-5 space-y-3">
        {filteredQuestions.map((item) => (
          <details
            key={item.question}
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm open:border-cyan-300 open:ring-4 open:ring-cyan-50"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-bold md:text-lg">{item.question}</h3>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xl text-cyan-800 transition group-open:rotate-45 group-open:bg-cyan-700 group-open:text-white"
              >
                +
              </span>
            </summary>
            <p className="border-t border-slate-100 px-5 py-4 text-sm leading-7 text-slate-600 md:text-base">
              {item.answer}
            </p>
          </details>
        ))}

        {!filteredQuestions.length ? (
          <div className="rounded-2xl border border-dashed border-cyan-300 bg-cyan-50 p-6 text-center">
            <p className="font-bold text-slate-900">No exact match yet.</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Try a shorter word, or ask Finn using the chat button in the bottom-right corner.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
