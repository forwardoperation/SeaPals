import { NextResponse } from "next/server";
import { ANSWER_QUESTIONS } from "@/data/survey/questions";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const QUESTION_IDS = new Set(ANSWER_QUESTIONS.map((question) => question.id));

function cleanText(value, maxLength = 2000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanAnswers(answers) {
  const cleaned = {};

  for (const [key, value] of Object.entries(answers ?? {})) {
    if (!QUESTION_IDS.has(key) && !key.endsWith("_other")) continue;

    if (Array.isArray(value)) {
      cleaned[key] = value.map((item) => cleanText(item, 120)).filter(Boolean);
    } else if (typeof value === "number") {
      cleaned[key] = value;
    } else {
      cleaned[key] = cleanText(value);
    }
  }

  return cleaned;
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid survey payload." }, { status: 400 });
  }

  const respondentName = cleanText(payload.respondentName, 120);
  const respondentAge = payload.respondentAge ? Number(payload.respondentAge) : null;
  const answers = cleanAnswers(payload.answers);

  if (!respondentName) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  if (respondentAge !== null && (!Number.isFinite(respondentAge) || respondentAge < 1)) {
    return NextResponse.json({ error: "Age must be a valid number." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("survey_responses").insert({
      survey_slug: "seapals-main",
      respondent_name: respondentName,
      respondent_age: respondentAge,
      answers,
      reward_status: "pending",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

