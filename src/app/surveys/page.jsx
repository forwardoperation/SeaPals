"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SURVEY_SECTIONS, SURVEY_TITLE } from "@/data/survey/questions";

const TOTAL_STEPS = SURVEY_SECTIONS.length;
const RESULTS_URL = "/surveys/results";

function getInitialAnswers() {
  const answers = {};

  for (const section of SURVEY_SECTIONS) {
    for (const question of section.questions) {
      if (question.type === "checkbox") answers[question.id] = [];
      else answers[question.id] = "";

      if (question.other) answers[`${question.id}_other`] = "";
    }
  }

  return answers;
}

function QuestionNumber({ number }) {
  if (!number) return null;

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-sm font-bold text-cyan-200">
      {number}
    </span>
  );
}

function ChoiceButton({ checked, children, ...props }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition has-disabled:cursor-not-allowed has-disabled:opacity-45 ${
        checked
          ? "border-cyan-200 bg-cyan-300/20 text-white"
          : "border-white/20 bg-slate-950/40 text-cyan-50 hover:border-cyan-200/70"
      }`}
    >
      <input className="h-4 w-4 accent-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200" checked={checked} {...props} />
      <span>{children}</span>
    </label>
  );
}

function SurveyQuestion({ question, value, otherValue, onChange, onOtherChange }) {
  const selectedCount = Array.isArray(value) ? value.length : 0;
  const maxReached = question.maxSelections && selectedCount >= question.maxSelections;

  function toggleCheckbox(option) {
    const current = Array.isArray(value) ? value : [];
    const isSelected = current.includes(option);

    if (!isSelected && maxReached) return;

    onChange(isSelected ? current.filter((item) => item !== option) : [...current, option]);
  }

  return (
    <section className="rounded-3xl border border-white/20 bg-slate-950/40 p-5 text-white shadow-sm">
      <div className="flex gap-3">
        <QuestionNumber number={question.number} />
        <div className="min-w-0 flex-1">
          <label className="block text-lg font-bold leading-7 text-white">
            {question.label}
          </label>
          {question.helper && (
            <p className="mt-1 text-sm font-semibold text-cyan-100/85">{question.helper}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        {question.type === "text" && (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required={question.required}
            className="w-full rounded-2xl border border-cyan-100/30 bg-slate-950/50 px-4 py-3 text-white placeholder:text-cyan-100/60 outline-none focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/35"
          />
        )}

        {question.type === "number" && (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            type="number"
            min={question.min}
            max={question.max}
            className="w-full rounded-2xl border border-cyan-100/30 bg-slate-950/50 px-4 py-3 text-white placeholder:text-cyan-100/60 outline-none focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/35"
          />
        )}

        {question.type === "textarea" && (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
            className="w-full resize-y rounded-2xl border border-cyan-100/30 bg-slate-950/50 px-4 py-3 text-white placeholder:text-cyan-100/60 outline-none focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/35"
          />
        )}

        {question.type === "radio" && (
          <div className="grid gap-3 md:grid-cols-2">
            {question.options.map((option) => (
              <ChoiceButton
                key={option}
                type="radio"
                name={question.id}
                checked={value === option}
                onChange={() => onChange(option)}
              >
                {option === "SeaPals" ? "SeaRealm" : option}
              </ChoiceButton>
            ))}
          </div>
        )}

        {question.type === "checkbox" && (
          <>
            {question.maxSelections && (
              <p className="mb-3 text-sm font-semibold text-cyan-100/85">
                {selectedCount} / {question.maxSelections} selected
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {question.options.map((option) => {
                const checked = Array.isArray(value) && value.includes(option);
                return (
                  <ChoiceButton
                    key={option}
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && maxReached}
                    onChange={() => toggleCheckbox(option)}
                  >
                    {option === "SeaPals" ? "SeaRealm" : option}
                  </ChoiceButton>
                );
              })}
            </div>
          </>
        )}

        {question.type === "scale" && (
          <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
            {Array.from({ length: question.max - question.min + 1 }, (_, index) => {
              const number = question.min + index;
              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => onChange(number)}
                  className={`aspect-square rounded-2xl border text-lg font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 ${
                    Number(value) === number
                      ? "border-cyan-200 bg-cyan-300/25 text-white"
                      : "border-white/20 bg-slate-950/40 text-cyan-50 hover:border-cyan-200/70"
                  }`}
                >
                  {number}
                </button>
              );
            })}
          </div>
        )}

        {question.other && (
          <input
            value={otherValue}
            onChange={(event) => onOtherChange(event.target.value)}
            placeholder="Other"
            className="mt-3 w-full rounded-2xl border border-cyan-100/30 bg-slate-950/50 px-4 py-3 text-white placeholder:text-cyan-100/60 outline-none focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/35"
          />
        )}
      </div>
    </section>
  );
}

export default function SurveyPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState(getInitialAnswers);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const currentSection = SURVEY_SECTIONS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / TOTAL_STEPS) * 100);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === TOTAL_STEPS - 1;

  const requiredMissing = useMemo(() => {
    return currentSection.questions.some(
      (question) => question.required && !String(answers[question.id] ?? "").trim()
    );
  }, [answers, currentSection]);

  function updateAnswer(questionId, value) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  async function submitSurvey() {
    setMessage("");
    setSubmitting(true);

    const response = await fetch("/api/survey-responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        respondentName: answers.respondent_name,
        respondentAge: answers.respondent_age,
        answers,
      }),
    });

    const result = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setMessage(result.error ?? "Survey could not be saved.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-3xl py-8">
        <section className="rounded-3xl border border-cyan-200/25 bg-slate-950/40 p-8 text-center shadow-sm">
          <h1 className="text-4xl font-bold text-white">Thank you!</h1>
          <p className="mt-3 text-lg text-cyan-100">
            Your SeaRealm survey was submitted. We saved your name so it can be counted
            for rewards.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={RESULTS_URL}
              className="rounded-xl bg-[#f7c948] px-5 py-3 font-bold text-[#082f49] hover:bg-[#ffda68] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
            >
              View Summary
            </Link>
            <button
              type="button"
              onClick={() => {
                setAnswers(getInitialAnswers());
                setStepIndex(0);
                setSubmitted(false);
              }}
              className="rounded-xl border border-cyan-100/30 px-5 py-3 font-bold text-cyan-50 hover:bg-white/15"
            >
              Submit Another
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 py-6">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-cyan-100">
            {SURVEY_TITLE}
          </p>
          <h1 className="mt-2 text-4xl font-bold text-white">
            Help us make SeaRealm even better
          </h1>
          <p className="mt-3 max-w-2xl text-cyan-100">
            Answer a few questions about what you like, what could improve, and what
            you would like to see next.
          </p>
        </div>
        <Link
          href={RESULTS_URL}
          className="inline-flex items-center justify-center rounded-xl border border-cyan-200/40 bg-slate-950/40 px-5 py-3 font-bold text-cyan-200 shadow-sm hover:bg-cyan-300/15"
        >
          View Results
        </Link>
      </section>

      <section className="rounded-3xl border-2 border-cyan-200/40 bg-cyan-950/45 p-5 text-cyan-50 shadow-sm">
        <h2 className="text-xl font-bold text-white">
          Privacy notice for players and parents
        </h2>
        <p className="mt-2 leading-7">
          Sea Realm, LLC stores the player&apos;s first name or nickname, age,
          and answers privately in Supabase so responses can be counted and
          summarized. A parent or legal guardian should submit this survey for
          a player under 13. Do not enter a full legal name, email, address,
          school, phone number, or other contact details in an answer.
        </p>
        <p className="mt-2 leading-7">
          Identifiable responses are scheduled for deletion or
          de-identification within 12 months. Read the{" "}
          <Link
            href="/privacy#collection"
            className="font-bold text-cyan-100 underline underline-offset-4"
          >
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link
            href="/terms#submissions"
            className="font-bold text-cyan-100 underline underline-offset-4"
          >
            Terms of Use
          </Link>
          .
        </p>
      </section>

      <section className="rounded-3xl border border-cyan-200/25 bg-slate-950/40 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 text-sm font-bold text-cyan-100">
          <span>
            Step {stepIndex + 1} of {TOTAL_STEPS}
          </span>
          <span>{progress}% complete</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-cyan-300 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-white">{currentSection.title}</h2>
        {currentSection.description && (
          <p className="mt-1 text-cyan-100">{currentSection.description}</p>
        )}
      </section>

      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        {currentSection.questions.map((question) => (
          <SurveyQuestion
            key={question.id}
            question={question}
            value={answers[question.id]}
            otherValue={answers[`${question.id}_other`]}
            onChange={(value) => updateAnswer(question.id, value)}
            onOtherChange={(value) => updateAnswer(`${question.id}_other`, value)}
          />
        ))}
      </form>

      {message && (
        <p className="rounded-2xl bg-rose-950/60 px-4 py-3 text-sm font-semibold text-rose-100">
          {message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          disabled={isFirstStep}
          className="rounded-xl border border-cyan-100/40 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={submitSurvey}
            disabled={submitting}
            className="rounded-xl bg-[#f7c948] px-5 py-3 font-bold text-[#082f49] hover:bg-[#ffda68] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700/60 disabled:text-slate-300"
          >
            {submitting ? "Submitting..." : "Submit Survey"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStepIndex((current) => Math.min(TOTAL_STEPS - 1, current + 1))}
            disabled={requiredMissing}
            className="rounded-xl bg-[#f7c948] px-5 py-3 font-bold text-[#082f49] hover:bg-[#ffda68] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700/60 disabled:text-slate-300"
          >
            Next
          </button>
        )}
      </div>
    </main>
  );
}
