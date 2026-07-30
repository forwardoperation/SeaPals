import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { summarizeSurveyResponses } from "@/lib/surveySummary.mjs";

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
      byQuestion: summarizeSurveyResponses(data ?? []),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
