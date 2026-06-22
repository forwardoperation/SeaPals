"use client";

import { Fragment, useMemo, useState } from "react";
import { ANSWER_QUESTIONS, SURVEY_SECTIONS } from "@/data/survey/questions";

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function formatAnswer(answers = {}, question) {
  const value = answers[question.id];
  const otherValue = answers[`${question.id}_other`];
  const values = [];

  if (Array.isArray(value)) {
    values.push(...value);
  } else if (value !== undefined && value !== null && String(value).trim()) {
    values.push(value);
  }

  if (otherValue !== undefined && otherValue !== null && String(otherValue).trim()) {
    values.push(`Other: ${otherValue}`);
  }

  return values.join("; ");
}

function addCount(counts, label) {
  if (!label) return;
  counts[label] = (counts[label] ?? 0) + 1;
}

function sortCounts(counts = {}) {
  return Object.entries(counts).sort((first, second) => second[1] - first[1]);
}

function buildSurveySummary(responses) {
  const summary = {};

  for (const question of ANSWER_QUESTIONS) {
    summary[question.id] = {
      answered: 0,
      counts: {},
      other: [],
      samples: [],
      scaleTotal: 0,
      scaleCount: 0,
    };
  }

  for (const response of responses) {
    const answers = response.answers ?? {};

    for (const question of ANSWER_QUESTIONS) {
      const item = summary[question.id];
      const value = answers[question.id];
      const otherValue = answers[`${question.id}_other`];
      const formattedAnswer = formatAnswer(answers, question);

      if (formattedAnswer) item.answered += 1;

      if (question.type === "checkbox") {
        for (const choice of Array.isArray(value) ? value : []) {
          addCount(item.counts, choice);
        }
        if (otherValue) item.other.push(String(otherValue));
      } else if (question.type === "radio") {
        addCount(item.counts, value);
        if (otherValue) item.other.push(String(otherValue));
      } else if (question.type === "scale") {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          item.scaleTotal += numeric;
          item.scaleCount += 1;
        }
      } else if (question.type === "textarea" && formattedAnswer) {
        item.samples.push(formattedAnswer);
      }
    }
  }

  return summary;
}

function QuestionSummary({ question, item, responseCount }) {
  const countEntries = sortCounts(item.counts);
  const hasCounts = countEntries.length > 0;
  const average =
    item.scaleCount > 0 ? Number((item.scaleTotal / item.scaleCount).toFixed(1)) : null;
  const maxCount = countEntries[0]?.[1] ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            {question.number ? `Q${question.number}. ` : ""}
            {question.label}
          </h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {item.answered} of {responseCount} answered
          </p>
        </div>
        {average !== null && (
          <div className="text-left md:text-right">
            <div className="text-3xl font-bold text-sky-700">{average}</div>
            <div className="text-xs font-semibold text-slate-500">Average</div>
          </div>
        )}
      </div>

      {hasCounts && (
        <div className="mt-4 space-y-3">
          {countEntries.map(([label, count]) => {
            const percentOfResponses = responseCount
              ? Math.round((count / responseCount) * 100)
              : 0;
            const barWidth = maxCount ? Math.round((count / maxCount) * 100) : 0;

            return (
              <div key={label}>
                <div className="mb-1 flex justify-between gap-3 text-sm font-semibold text-slate-700">
                  <span>{label}</span>
                  <span>
                    {count} ({percentOfResponses}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {item.other.length > 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Other answers
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {item.other.slice(0, 6).join("; ")}
          </p>
        </div>
      )}

      {question.type === "textarea" && (
        <div className="mt-4 space-y-2">
          {item.samples.slice(0, 5).map((sample, index) => (
            <p
              key={`${question.id}-${index}`}
              className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
            >
              {sample}
            </p>
          ))}
          {item.samples.length === 0 && (
            <p className="text-sm text-slate-500">No written answers yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AggregateDashboard({ responses, summary }) {
  const responseCount = responses.length;
  const npsSummary = summary.tell_friend_likelihood;
  const npsAverage =
    npsSummary?.scaleCount > 0
      ? Number((npsSummary.scaleTotal / npsSummary.scaleCount).toFixed(1))
      : null;
  const recommendationTop = sortCounts(summary.recommend_to_friend?.counts)[0];
  const favoritePartTop = sortCounts(summary.favorite_part?.counts)[0];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Aggregate Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">
            Summary findings from loaded survey responses.
          </p>
        </div>
        <div className="text-sm font-bold text-slate-500">
          {responseCount} response{responseCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Tell-a-friend average
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {npsAverage ?? "No data"}
            {npsAverage !== null && <span className="text-base text-slate-500"> / 10</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Top recommendation answer
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {recommendationTop?.[0] ?? "No data"}
          </div>
        </div>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Favorite part
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {favoritePartTop?.[0] ?? "No data"}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {SURVEY_SECTIONS.filter((section) => section.id !== "respondent").map((section) => (
          <section key={section.id}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {section.title}
            </h3>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {section.questions
                .filter((question) => !question.systemField)
                .map((question) => (
                  <QuestionSummary
                    key={question.id}
                    question={question}
                    item={summary[question.id]}
                    responseCount={responseCount}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function downloadCsv(responses) {
  const answerHeaders = ANSWER_QUESTIONS.map((question) =>
    question.number ? `Q${question.number}: ${question.label}` : question.label
  );
  const rows = [
    ["Name", "Age", "Submitted At", "Reward Status", ...answerHeaders],
    ...responses.map((response) => [
      response.respondent_name,
      response.respondent_age ?? "",
      response.submitted_at,
      response.reward_status,
      ...ANSWER_QUESTIONS.map((question) => formatAnswer(response.answers, question)),
    ]),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "seapals-survey-rewards.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminSurveysPage() {
  const [token, setToken] = useState("");
  const [responses, setResponses] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [openResponseId, setOpenResponseId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const counts = useMemo(() => {
    return responses.reduce(
      (totals, response) => {
        totals.total += 1;
        totals[response.reward_status] = (totals[response.reward_status] ?? 0) + 1;
        return totals;
      },
      { total: 0, pending: 0, counted: 0, void: 0 }
    );
  }, [responses]);

  const surveySummary = useMemo(() => buildSurveySummary(responses), [responses]);

  async function loadResponses() {
    setMessage("");
    setLoading(true);

    const response = await fetch("/api/admin/survey-responses", {
      headers: { "x-admin-token": token },
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(result.error ?? "Could not load responses.");
      return;
    }

    setResponses(result.responses ?? []);
    setOpenResponseId("");
  }

  async function updateRewardStatus(id, rewardStatus) {
    const response = await fetch("/api/admin/survey-responses", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ id, rewardStatus }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Could not update reward status.");
      return;
    }

    setResponses((current) =>
      current.map((item) => (item.id === id ? { ...item, reward_status: rewardStatus } : item))
    );
  }

  async function deleteResponse(response) {
    const confirmed = window.confirm(
      `Delete ${response.respondent_name}'s survey response? This cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");
    setDeletingId(response.id);

    const apiResponse = await fetch("/api/admin/survey-responses", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ id: response.id }),
    });

    const result = await apiResponse.json();
    setDeletingId("");

    if (!apiResponse.ok) {
      setMessage(result.error ?? "Could not delete survey response.");
      return;
    }

    setResponses((current) => current.filter((item) => item.id !== response.id));
    setOpenResponseId((current) => (current === response.id ? "" : current));
    setMessage(`Deleted ${response.respondent_name}'s survey response.`);
  }

  return (
    <main className="space-y-6 py-6">
      <section>
        <p className="text-sm font-bold uppercase tracking-wide text-sky-700">
          Admin
        </p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900">
          Survey Reward Tracker
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Use this to count submitted names for the external rewards system.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-bold text-slate-700">
          Admin Token
        </label>
        <div className="mt-2 flex flex-col gap-3 md:flex-row">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3"
          />
          <button
            type="button"
            onClick={loadResponses}
            disabled={loading || !token}
            className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Loading..." : "Load Responses"}
          </button>
        </div>
      </section>

      {message && (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {message}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Total", counts.total],
          ["Pending", counts.pending],
          ["Counted", counts.counted],
          ["Void", counts.void],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
          </div>
        ))}
      </section>

      {responses.length > 0 && (
        <AggregateDashboard responses={responses} summary={surveySummary} />
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Submissions</h2>
          <button
            type="button"
            onClick={() => downloadCsv(responses)}
            disabled={responses.length === 0}
            className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download CSV
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Age</th>
                <th className="py-3 pr-4">Submitted</th>
                <th className="py-3 pr-4">Reward Status</th>
                <th className="py-3 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((response) => {
                const isOpen = openResponseId === response.id;

                return (
                  <Fragment key={response.id}>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenResponseId((current) =>
                              current === response.id ? "" : response.id
                            )
                          }
                          className="text-left font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                        >
                          {response.respondent_name}
                        </button>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {response.respondent_age ?? ""}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {new Date(response.submitted_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={response.reward_status}
                          onChange={(event) => updateRewardStatus(response.id, event.target.value)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700"
                        >
                          <option value="pending">Pending</option>
                          <option value="counted">Counted</option>
                          <option value="void">Void</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => deleteResponse(response)}
                          disabled={deletingId === response.id}
                          className="rounded-xl border border-rose-200 px-3 py-2 font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === response.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-b border-slate-100">
                        <td colSpan={5} className="bg-slate-50 px-4 py-5">
                          <div className="space-y-5">
                            {SURVEY_SECTIONS.filter((section) => section.id !== "respondent").map(
                              (section) => (
                                <section key={section.id}>
                                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                                    {section.title}
                                  </h3>
                                  <div className="mt-3 grid gap-3">
                                    {section.questions
                                      .filter((question) => !question.systemField)
                                      .map((question) => {
                                        const answer = formatAnswer(response.answers, question);

                                        return (
                                          <div
                                            key={question.id}
                                            className="rounded-2xl border border-slate-200 bg-white p-4"
                                          >
                                            <div className="text-sm font-bold text-slate-900">
                                              {question.number ? `Q${question.number}. ` : ""}
                                              {question.label}
                                            </div>
                                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                              {answer || "No answer"}
                                            </p>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </section>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {responses.length === 0 && (
            <p className="py-8 text-center text-slate-500">No responses loaded.</p>
          )}
        </div>
      </section>
    </main>
  );
}
