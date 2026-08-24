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
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
      {number}
    </span>
  );
}

function ChoiceButton({ checked, children, ...props }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
        checked
          ? "border-sky-500 bg-sky-50 text-sky-900"
          : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
      }`}
    >
      <input className="h-4 w-4 accent-sky-600" checked={checked} {...props} />
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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <QuestionNumber number={question.number} />
        <div className="min-w-0 flex-1">
          <label className="block text-lg font-bold leading-7 text-slate-900">
            {question.label}
          </label>
          {question.helper && (
            <p className="mt-1 text-sm font-semibold text-slate-500">{question.helper}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        {question.type === "text" && (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required={question.required}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          />
        )}

        {question.type === "number" && (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            type="number"
            min={question.min}
            max={question.max}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          />
        )}

        {question.type === "textarea" && (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
            className="w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
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
                {option}
              </ChoiceButton>
            ))}
          </div>
        )}

        {question.type === "checkbox" && (
          <>
            {question.maxSelections && (
              <p className="mb-3 text-sm font-semibold text-slate-500">
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
                    {option}
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
                  className={`aspect-square rounded-2xl border text-lg font-bold transition ${
                    Number(value) === number
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
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
            className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
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
        <section className="rounded-3xl border border-cyan-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-4xl font-bold text-slate-900">Thank you!</h1>
          <p className="mt-3 text-lg text-slate-600">
            Your SeaPals survey was submitted. We saved your name so it can be counted
            for rewards.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={RESULTS_URL}
              className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700"
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
              className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
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
          <p className="text-sm font-bold uppercase tracking-wide text-sky-700">
            {SURVEY_TITLE}
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-900">
            Help us make SeaPals even better
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Answer a few questions about what you like, what could improve, and what
            you would like to see next.
          </p>
        </div>
        <Link
          href={RESULTS_URL}
          className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-white px-5 py-3 font-bold text-sky-700 shadow-sm hover:bg-sky-50"
        >
          View Results
        </Link>
      </section>

      <section className="rounded-3xl border-2 border-cyan-300 bg-cyan-50 p-5 text-slate-700 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
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
            className="font-bold text-cyan-800 underline underline-offset-4"
          >
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link
            href="/terms#submissions"
            className="font-bold text-cyan-800 underline underline-offset-4"
          >
            Terms of Use
          </Link>
          .
        </p>
      </section>

      <section className="rounded-3xl border border-cyan-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 text-sm font-bold text-slate-600">
          <span>
            Step {stepIndex + 1} of {TOTAL_STEPS}
          </span>
          <span>{progress}% complete</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-slate-900">{currentSection.title}</h2>
        {currentSection.description && (
          <p className="mt-1 text-slate-600">{currentSection.description}</p>
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
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          disabled={isFirstStep}
          className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={submitSurvey}
            disabled={submitting}
            className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Submitting..." : "Submit Survey"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStepIndex((current) => Math.min(TOTAL_STEPS - 1, current + 1))}
            disabled={requiredMissing}
            className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Next
          </button>
        )}
      </div>
    </main>
  );
}
