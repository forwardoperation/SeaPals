import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

function isAuthorized(request) {
  const configuredToken = process.env.SURVEY_ADMIN_TOKEN?.trim();
  const providedToken = request.headers.get("x-admin-token")?.trim();

  return Boolean(configuredToken && providedToken && providedToken === configuredToken);
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("survey_responses")
      .select("id, submitted_at, respondent_name, respondent_age, reward_status, answers")
      .eq("survey_slug", "seapals-main")
      .order("submitted_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ responses: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json();
  const responseId = String(payload.id ?? "");
  const rewardStatus = String(payload.rewardStatus ?? "");

  if (!responseId || !["pending", "counted", "void"].includes(rewardStatus)) {
    return NextResponse.json({ error: "Invalid reward update." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("survey_responses")
      .update({ reward_status: rewardStatus })
      .eq("id", responseId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json();
  const responseId = String(payload.id ?? "");

  if (!responseId) {
    return NextResponse.json({ error: "Missing survey response id." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("survey_responses")
      .delete()
      .eq("id", responseId)
      .eq("survey_slug", "seapals-main");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
