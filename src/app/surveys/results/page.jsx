"use client";

import { useEffect, useMemo, useState } from "react";
import { ANSWER_QUESTIONS } from "@/data/survey/questions";

function sortCounts(counts = {}) {
  return Object.entries(counts).sort((first, second) => second[1] - first[1]);
}

export default function SurveyResultsPage() {
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSummary() {
      const response = await fetch("/api/survey-summary");
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Could not load survey summary.");
        return;
      }

      setSummary(result);
    }

    loadSummary();
  }, []);

  const highlightedQuestions = useMemo(
    () =>
      ANSWER_QUESTIONS.filter((question) =>
        [
          "seapals_words",
          "compared_to_other_games",
          "favorite_part",
          "recommend_to_friend",
          "tell_friend_likelihood",
          "see_next",
        ].includes(question.id)
      ),
    []
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 py-6">
      <section>
        <p className="text-sm font-bold uppercase tracking-wide text-sky-700">
          Survey Summary
        </p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900">
          What players are telling us
        </h1>
        <p className="mt-3 text-slate-600">
          Public results are aggregated and do not show respondent names.
        </p>
      </section>

      {message && (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {message}
        </p>
      )}

      {!summary && !message && <p className="text-slate-500">Loading summary...</p>}

      {summary && (
        <>
          <section className="rounded-3xl border border-cyan-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Responses Collected
            </div>
            <div className="mt-2 text-5xl font-bold text-slate-900">
              {summary.responseCount}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            {highlightedQuestions.map((question) => {
              const item = summary.byQuestion?.[question.id];

              return (
                <section
                  key={question.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="text-lg font-bold text-slate-900">{question.label}</h2>

                  {item?.type === "scale" && (
                    <p className="mt-4 text-4xl font-bold text-sky-700">
                      {item.average ?? "No data"}
                      {item.average ? <span className="text-lg text-slate-500"> / 10</span> : null}
                    </p>
                  )}

                  {["radio", "checkbox"].includes(item?.type) && (
                    <div className="mt-4 space-y-3">
                      {sortCounts(item.counts).map(([label, count]) => {
                        const percent = summary.responseCount
                          ? Math.round((count / summary.responseCount) * 100)
                          : 0;

                        return (
                          <div key={label}>
                            <div className="mb-1 flex justify-between gap-3 text-sm font-semibold text-slate-700">
                              <span>{label}</span>
                              <span>{count}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-cyan-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

