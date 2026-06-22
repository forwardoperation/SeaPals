import { NextResponse } from "next/server";
import { ANSWER_QUESTIONS } from "@/data/survey/questions";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

function addCount(bucket, key) {
  if (!key) return;
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function summarizeResponses(responses) {
  const byQuestion = {};

  for (const question of ANSWER_QUESTIONS) {
    if (["radio", "checkbox"].includes(question.type)) {
      byQuestion[question.id] = { type: question.type, counts: {}, other: [] };
    } else if (question.type === "scale") {
      byQuestion[question.id] = { type: "scale", average: null, count: 0 };
    } else if (question.type === "textarea") {
      byQuestion[question.id] = { type: "textarea", samples: [] };
    }
  }

  for (const response of responses) {
    const answers = response.answers ?? {};

    for (const question of ANSWER_QUESTIONS) {
      const summary = byQuestion[question.id];
      const value = answers[question.id];
      const otherValue = answers[`${question.id}_other`];

      if (!summary) continue;

      if (question.type === "checkbox") {
        for (const item of Array.isArray(value) ? value : []) {
          addCount(summary.counts, item);
        }
        if (otherValue) summary.other.push(otherValue);
      } else if (question.type === "radio") {
        addCount(summary.counts, value);
        if (otherValue) summary.other.push(otherValue);
      } else if (question.type === "scale") {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          summary.average = (summary.average ?? 0) + numeric;
          summary.count += 1;
        }
      } else if (question.type === "textarea" && value && summary.samples.length < 8) {
        summary.samples.push(String(value));
      }
    }
  }

  for (const question of ANSWER_QUESTIONS) {
    const summary = byQuestion[question.id];
    if (summary?.type === "scale" && summary.count > 0) {
      summary.average = Number((summary.average / summary.count).toFixed(1));
    }
  }

  return byQuestion;
}

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("survey_responses")
      .select("answers")
      .eq("survey_slug", "seapals-main")
      .order("submitted_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({
      responseCount: data?.length ?? 0,
      byQuestion: summarizeResponses(data ?? []),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

