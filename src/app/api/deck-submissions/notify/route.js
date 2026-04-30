import { NextResponse } from "next/server";

const STATUS_LABELS = {
  approved: "approved",
  changesRequested: "changes requested",
  rejected: "declined",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEmail({ playerName, deckName, tournamentName, status, adminNotes, editUrl }) {
  const statusLabel = STATUS_LABELS[status] ?? status;
  const needsRevision = status === "changesRequested" || status === "rejected";
  const greetingName = playerName || "there";

  const text = [
    `Hi ${greetingName},`,
    "",
    `Your deck "${deckName}" for ${tournamentName} was ${statusLabel}.`,
    adminNotes ? `Admin notes: ${adminNotes}` : "",
    needsRevision
      ? `You can update your deck here: ${editUrl}`
      : `Your deck edit link is here if you need it: ${editUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>Hi ${escapeHtml(greetingName)},</p>
    <p>
      Your deck <strong>${escapeHtml(deckName)}</strong> for
      <strong>${escapeHtml(tournamentName)}</strong> was
      <strong>${escapeHtml(statusLabel)}</strong>.
    </p>
    ${
      adminNotes
        ? `<p><strong>Admin notes:</strong><br>${escapeHtml(adminNotes).replaceAll("\n", "<br>")}</p>`
        : ""
    }
    <p>
      ${
        needsRevision
          ? "You can update your deck here:"
          : "Your deck edit link is here if you need it:"
      }
      <br>
      <a href="${escapeHtml(editUrl)}">${escapeHtml(editUrl)}</a>
    </p>
  `;

  return { text, html };
}

export async function POST(request) {
  const payload = await request.json();
  const {
    to,
    playerName,
    deckName,
    tournamentName,
    status,
    adminNotes,
    editUrl,
  } = payload;

  if (!to || !deckName || !tournamentName || !status || !editUrl) {
    return NextResponse.json(
      { error: "Missing email notification details." },
      { status: 400 }
    );
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({
      skipped: true,
      message: "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM.",
    });
  }

  const statusLabel = STATUS_LABELS[status] ?? status;
  const { text, html } = buildEmail({
    playerName,
    deckName,
    tournamentName,
    status,
    adminNotes,
    editUrl,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject: `SeaPals deck ${statusLabel}: ${deckName}`,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Email failed: ${error}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ sent: true });
}
