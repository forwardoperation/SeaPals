import { ANSWER_QUESTIONS } from "../data/survey/questions.js";

function addCount(bucket, key) {
  if (!key) return;
  bucket[key] = (bucket[key] ?? 0) + 1;
}

export function summarizeSurveyResponses(
  responses,
  questions = ANSWER_QUESTIONS,
) {
  const byQuestion = {};

  for (const question of questions) {
    if (["radio", "checkbox"].includes(question.type)) {
      byQuestion[question.id] = { type: question.type, counts: {} };
    } else if (question.type === "scale") {
      byQuestion[question.id] = { type: "scale", average: null, count: 0 };
    }
  }

  for (const response of responses) {
    const answers = response.answers ?? {};

    for (const question of questions) {
      const summary = byQuestion[question.id];
      const value = answers[question.id];
      const allowedOptions = new Set(question.options ?? []);

      if (!summary) continue;

      if (question.type === "checkbox") {
        for (const item of Array.isArray(value) ? value : []) {
          if (allowedOptions.has(item)) addCount(summary.counts, item);
        }
      } else if (question.type === "radio") {
        if (allowedOptions.has(value)) addCount(summary.counts, value);
      } else if (question.type === "scale") {
        const numeric = Number(value);
        if (
          Number.isFinite(numeric)
          && numeric >= question.min
          && numeric <= question.max
        ) {
          summary.average = (summary.average ?? 0) + numeric;
          summary.count += 1;
        }
      }
    }
  }

  for (const question of questions) {
    const summary = byQuestion[question.id];
    if (summary?.type === "scale" && summary.count > 0) {
      summary.average = Number((summary.average / summary.count).toFixed(1));
    }
  }

  return byQuestion;
}
