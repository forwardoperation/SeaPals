"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { allCards } from "@/data/cards";
import { OFFICIAL_RULINGS } from "@/data/rules/officialRulings.mjs";
import { CORE_RULES, extractRulesChunksFromHtml } from "@/lib/rulesAssistant.mjs";
import { answerRulesQuestion } from "@/lib/rulesEngine.mjs";
import { buildRulesKnowledgeBank } from "@/lib/rulesKnowledgeBank.mjs";
import { SIMULATOR_RULES } from "@/lib/seapalsRulesKnowledge.mjs";
import { resolveSimulatorFinnQuestion } from "@/app/simulator/simulatorFinnHelp.mjs";
import {
  RULES_CHAT_PLACEMENTS,
  getRulesChatGreeting,
  getRulesChatSuggestions,
  shouldRenderRulesChat,
} from "./rulesChatPresentation.mjs";

const knowledgeSources = {
  cards: allCards,
  coreRules: CORE_RULES,
  officialRulings: OFFICIAL_RULINGS,
  simulatorRules: SIMULATOR_RULES,
};

let rulesPromise;
const BUILT_IN_RULES = buildRulesKnowledgeBank(knowledgeSources);

async function loadRules() {
  if (!rulesPromise) {
    rulesPromise = fetch("/instructions", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Rules page was unavailable.");
        return response.text();
      })
      .then(extractRulesChunksFromHtml)
      .then((currentRules) => {
        if (!currentRules.length) throw new Error("No rules content was found.");
        return buildRulesKnowledgeBank({ ...knowledgeSources, currentRules });
      })
      .catch((error) => {
        rulesPromise = undefined;
        throw error;
      });
  }
  return rulesPromise;
}

function BotMark({ compact = false }) {
  return (
    <span aria-hidden="true" className={`relative block shrink-0 overflow-hidden rounded-full border border-cyan-200 bg-cyan-50 ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
      <span
        className="absolute"
        style={{
          top: "-5%",
          left: "-30%",
          width: "160%",
          height: "228.571%",
          backgroundImage: "url(/images/adventure/dorian-sprites-512-v3.webp)",
          backgroundPosition: "49.6% 4.276316%",
          backgroundRepeat: "no-repeat",
          backgroundSize: "457.142857% 480%",
          imageRendering: "pixelated",
        }}
      />
    </span>
  );
}

function formatMessageText(text) {
  return String(text ?? "").replace(/\s+(?=\d+\.\s)/g, "\n");
}

export default function RulesChat({
  placement = RULES_CHAT_PLACEMENTS.SITE,
  gamePhase = null,
  activeConditionName = null,
  gameContext = null,
}) {
  const pathname = usePathname();
  const simulatorPlacement = placement === RULES_CHAT_PLACEMENTS.SIMULATOR;
  const suggestions = useMemo(() => getRulesChatSuggestions({
    placement,
    gamePhase,
    activeConditionName,
  }), [activeConditionName, gamePhase, placement]);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [rules, setRules] = useState(BUILT_IN_RULES);
  const [status, setStatus] = useState("ready");
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: getRulesChatGreeting(placement),
    },
  ]);
  const conversationContextRef = useRef({});
  const inputRef = useRef(null);
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    setStatus("refreshing");
    loadRules()
      .then((currentRules) => {
        setRules(currentRules);
        setStatus("ready");
      })
      .catch(() => setStatus("fallback"));

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

    const simulatorResolution = simulatorPlacement
      ? resolveSimulatorFinnQuestion(nextQuestion, gameContext ?? {})
      : null;
    const answer = simulatorResolution?.answer
      ?? answerRulesQuestion(simulatorResolution?.delegatedQuestion ?? nextQuestion, rules, conversationContextRef.current);
    if (!answer) return;
    if (answer.context) conversationContextRef.current = answer.context;
    setMessages((current) => [
      ...current,
      { role: "user", text: nextQuestion },
      { role: "bot", ...answer },
    ]);
    setQuestion("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    ask(question);
  }

  // Game routes embed their own instance so Finn can sit beside match controls
  // without covering the action dock or duplicating the global launcher.
  if (!shouldRenderRulesChat(pathname, placement)) return null;

  return (
    <div
      className={simulatorPlacement ? "relative" : "fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6"}
      style={simulatorPlacement ? { zIndex: 65 } : undefined}
    >
      {open ? (
        <section
          aria-label="SeaPals rules chat"
          className={`${simulatorPlacement ? "absolute right-0" : "mb-3"} flex flex-col overflow-hidden rounded-3xl border border-cyan-200 bg-white shadow-2xl shadow-cyan-950/20`}
          style={{
            ...(simulatorPlacement ? { top: "calc(100% + 0.75rem)", zIndex: 66 } : null),
            height: "min(620px, calc(100dvh - 7rem))",
            width: "min(390px, calc(100vw - 2rem))",
          }}
          role="dialog"
        >
          <header className="flex items-center gap-3 bg-gradient-to-r from-cyan-700 to-teal-600 px-4 py-3 text-white">
            <BotMark />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">Ask Finn</h2>
              <p className="text-xs text-cyan-50">SeaPals rules buddy</p>
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
                  <p className="whitespace-pre-line">{formatMessageText(message.text)}</p>
                  {message.options?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.options.map((option) => (
                        <button
                          className="rounded-full border border-cyan-200 px-2 py-1 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-50"
                          key={option}
                          onClick={() => ask(option)}
                          type="button"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.sources?.length ? (
                    <div className="mt-2 border-t border-cyan-100 pt-2 text-[10px] leading-4 text-slate-400">
                      <span>Based on: </span>
                      {message.sources.map((source, sourceIndex) => (
                        <span key={`${source.id ?? source.label}-${sourceIndex}`}>
                          {sourceIndex ? " · " : ""}
                          <Link
                            className="underline decoration-slate-300 underline-offset-2"
                            href={source.href ?? "/instructions"}
                            target={simulatorPlacement ? "_blank" : undefined}
                            rel={simulatorPlacement ? "noreferrer" : undefined}
                          >
                            {source.label}
                          </Link>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {message.showRulesLink ? (
                    <Link
                      className="mt-2 inline-block font-bold text-cyan-700 underline"
                      href="/instructions"
                      target={simulatorPlacement ? "_blank" : undefined}
                      rel={simulatorPlacement ? "noreferrer" : undefined}
                    >
                      Open How to Play
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    className="rounded-full border border-cyan-200 bg-white px-3 py-2 text-left text-xs font-semibold text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-50"
                    key={suggestion}
                    onClick={() => ask(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {status === "refreshing" ? <p className="text-center text-xs text-slate-500">Checking the latest rules…</p> : null}
            {status === "fallback" ? (
              <p className="text-center text-xs text-amber-700">Using the built-in rules and card data while the live page is unavailable.</p>
            ) : null}
          </div>

          <form className="border-t border-cyan-100 bg-white p-3" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="rules-question">Ask a SeaPals rules question</label>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                id="rules-question"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about the rules…"
                ref={inputRef}
                value={question}
              />
              <button
                aria-label="Send question"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cyan-700 text-lg text-white transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!question.trim()}
                type="submit"
              >
                ↑
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">Answers cite this site’s current rules and card data.</p>
          </form>
        </section>
      ) : null}

      <button
        aria-expanded={open}
        aria-label={open ? "Close SeaPals rules chat" : "Open SeaPals rules chat"}
        className={simulatorPlacement
          ? "flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-cyan-100 shadow-lg transition hover:border-cyan-200/50 hover:bg-cyan-300/15 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          : "ml-auto flex items-center gap-2 rounded-full bg-cyan-700 p-2.5 pr-4 font-bold text-white shadow-xl shadow-cyan-950/25 transition hover:-translate-y-0.5 hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-200"}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <BotMark compact={simulatorPlacement} />
        <span>Ask Finn</span>
      </button>
    </div>
  );
}
