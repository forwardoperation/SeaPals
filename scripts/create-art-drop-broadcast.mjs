import process from "node:process";

const KIT_API_URL = "https://api.kit.com/v4/broadcasts";

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cardNameFromPath(filePath) {
  const fileName = filePath.split("/").pop() ?? filePath;

  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function publicUrlPath(filePath) {
  return filePath.replace(/^public\//, "");
}

function buildBroadcast({ files, siteUrl }) {
  const galleryUrl = `${siteUrl.replace(/\/$/, "")}/gallery`;
  const cards = files.map((filePath) => ({
    name: cardNameFromPath(filePath),
    imageUrl: `${siteUrl.replace(/\/$/, "")}/${publicUrlPath(filePath)}`,
  }));
  const subject =
    cards.length === 1
      ? `New SeaPals card art: ${cards[0].name}`
      : `New SeaPals card art: ${cards.length} reveals`;
  const previewText =
    cards.length === 1
      ? `${cards[0].name} just joined the SeaPals Card Gallery.`
      : `${cards.length} new cards just joined the SeaPals Card Gallery.`;
  const cardList = cards
    .map(
      (card) => `
        <figure style="margin: 24px 0;">
          <img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)}" style="max-width: 320px; width: 100%; height: auto; border-radius: 16px;" />
          <figcaption style="margin-top: 8px; font-weight: 700;">${escapeHtml(card.name)}</figcaption>
        </figure>
      `
    )
    .join("");

  const content = `
    <h1>A New SeaPal Just Surfaced!</h1>
    <p>
      ${cards.length === 1 ? "A new card has" : "New cards have"} joined the gallery.
    </p>
    ${cardList}
    <p>
      <a href="${escapeHtml(galleryUrl)}">Explore the Card Gallery</a>
    </p>
  `;

  return {
    subject,
    previewText,
    content,
    description: subject,
  };
}

async function main() {
  const apiKey = requiredEnv("KIT_API_KEY");
  const siteUrl = process.env.SITE_URL || "https://seapalstcg.com";
  const mode = process.env.KIT_BROADCAST_MODE || "draft";
  const rawFiles = requiredEnv("ART_DROP_FILES");
  const files = rawFiles
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);

  if (files.length === 0) {
    console.log("No new card art files found. Skipping Kit broadcast.");
    return;
  }

  if (mode !== "draft" && mode !== "send") {
    throw new Error('KIT_BROADCAST_MODE must be either "draft" or "send".');
  }

  const broadcast = buildBroadcast({ files, siteUrl });
  const sendAt = mode === "send" ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;
  const payload = {
    content: broadcast.content,
    description: broadcast.description,
    public: true,
    published_at: new Date().toISOString(),
    preview_text: broadcast.previewText,
    subject: broadcast.subject,
    subscriber_filter: [],
    send_at: sendAt,
    thumbnail_alt: files.length === 1 ? cardNameFromPath(files[0]) : "SeaPals card art",
    thumbnail_url: `${siteUrl.replace(/\/$/, "")}/${publicUrlPath(files[0])}`,
  };

  if (process.env.KIT_FROM_EMAIL) {
    payload.email_address = process.env.KIT_FROM_EMAIL;
  }

  const response = await fetch(KIT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Kit broadcast failed: ${response.status} ${body}`);
  }

  const result = await response.json();
  console.log(
    `${mode === "send" ? "Scheduled" : "Created draft"} Kit broadcast ${result.broadcast?.id ?? ""}`.trim()
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
