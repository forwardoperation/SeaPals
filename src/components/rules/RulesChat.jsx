"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { findRulesAnswer } from "@/lib/rulesAssistant.mjs";

const suggestions = [
  "How do I start a game?",
  "How does attacking work?",
  "How do I win?",
];

let rulesPromise;

function extractRulesChunks(html) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const headings = [...document.querySelectorAll("main h1, main h2, main h3")];

  return headings
    .map((heading) => {
      const container = heading.parentElement;
      if (!container) return null;

      const text = [...container.querySelectorAll(":scope > p, :scope > ul > li, :scope > ol > li")]
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" ");

      return text
        ? { title: heading.textContent?.replace(/\s+/g, " ").trim() || "SeaPals rules", text }
        : null;
    })
    .filter(Boolean);
}

async function loadRules() {
  if (!rulesPromise) {
    rulesPromise = fetch("/instructions", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Rules page was unavailable.");
        return response.text();
      })
      .then(extractRulesChunks)
      .then((chunks) => {
        if (!chunks.length) throw new Error("No rules content was found.");
        return chunks;
      })
      .catch((error) => {
        rulesPromise = undefined;
        throw error;
      });
  }
  return rulesPromise;
}

function BotMark() {
  return (
    <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-100 text-xl">
      🐠
    </span>
  );
}

export default function RulesChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [rules, setRules] = useState([]);
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Ahoy! I’m Finn, your SeaPals rules buddy. What would you like to know?",
    },
  ]);
  const inputRef = useRef(null);
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    setStatus("loading");
    loadRules()
      .then((chunks) => {
        setRules(chunks);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 100);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function ask(rawQuestion) {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion) return;

    const answer = findRulesAnswer(nextQuestion, rules);
    setMessages((current) => [
      ...current,
      { role: "user", text: nextQuestion },
      answer
        ? { role: "bot", title: answer.title, text: answer.text }
        : {
            role: "bot",
            text: "I couldn’t find that in the current rules, and I don’t want to guess. Try asking with a card type or game term, or open the full How to Play guide.",
            showRulesLink: true,
          },
    ]);
    setQuestion("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (status === "ready") ask(question);
  }

  // The simulator owns the full viewport and supplies its own contextual game
  // feedback. Keeping the global launcher here covers critical mobile actions.
  if (pathname === "/simulator") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open ? (
        <section
          aria-label="SeaPals rules chat"
          className="mb-3 flex h-[min(620px,calc(100vh-7rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-cyan-200 bg-white shadow-2xl shadow-cyan-950/20"
          role="dialog"
        >
          <header className="flex items-center gap-3 bg-gradient-to-r from-cyan-700 to-teal-600 px-4 py-3 text-white">
            <BotMark />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">Ask Finn</h2>
              <p className="text-xs text-cyan-50">SeaPals rules buddy · no AI fees</p>
            </div>
            <button
              aria-label="Close rules chat"
              className="grid h-9 w-9 place-items-center rounded-full text-2xl leading-none transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              ×
            </button>
          </header>

          <div
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto bg-cyan-50/50 p-4"
            ref={transcriptRef}
          >
            {messages.map((message, index) => (
              <div
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                key={`${message.role}-${index}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-md bg-cyan-700 text-white"
                      : "rounded-bl-md bg-white text-slate-700 shadow-sm ring-1 ring-cyan-100"
                  }`}
                >
                  {message.title ? <p className="mb-1 font-bold text-slate-950">{message.title}</p> : null}
                  <p>{message.text}</p>
                  {message.showRulesLink ? (
                    <Link className="mt-2 inline-block font-bold text-cyan-700 underline" href="/instructions">
                      Open How to Play
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}

            {messages.length === 1 && status !== "error" ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    className="rounded-full border border-cyan-200 bg-white px-3 py-2 text-left text-xs font-semibold text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60"
                    disabled={status !== "ready"}
                    key={suggestion}
                    onClick={() => ask(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {status === "loading" ? <p className="text-center text-xs text-slate-500">Reading the latest rules…</p> : null}
            {status === "error" ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                I can’t reach the rules right now. You can still use the {" "}
                <Link className="font-bold underline" href="/instructions">How to Play guide</Link>.
              </p>
            ) : null}
          </div>

          <form className="border-t border-cyan-100 bg-white p-3" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="rules-question">Ask a SeaPals rules question</label>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                disabled={status !== "ready"}
                id="rules-question"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={status === "loading" ? "Reading the rules…" : "Ask about the rules…"}
                ref={inputRef}
                value={question}
              />
              <button
                aria-label="Send question"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cyan-700 text-lg text-white transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={status !== "ready" || !question.trim()}
                type="submit"
              >
                ↑
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">Answers come from this site’s current rules.</p>
          </form>
        </section>
      ) : null}

      <button
        aria-expanded={open}
        aria-label={open ? "Close SeaPals rules chat" : "Open SeaPals rules chat"}
        className="ml-auto flex items-center gap-2 rounded-full bg-cyan-700 p-2.5 pr-4 font-bold text-white shadow-xl shadow-cyan-950/25 transition hover:-translate-y-0.5 hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-200"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <BotMark />
        <span>Ask Finn</span>
      </button>
    </div>
  );
}
