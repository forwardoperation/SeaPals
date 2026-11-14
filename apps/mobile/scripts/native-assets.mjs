import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Deterministic exports of the existing SeaRealm brand, preserving the logo.
// The source stays in public/images/brand; these are Xcode catalog outputs.
const root = fileURLToPath(new URL("../../..", import.meta.url));
const catalog = path.join(root, "apps/mobile/ios/App/App/Assets.xcassets");
const logo = path.join(root, "public/images/brand/searealm-tcg-logo.png");
async function brandedSquare(size, logoWidth) {
  const background = Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sea" x2=".8" y2="1"><stop stop-color="#147083"/><stop offset="1" stop-color="#061b2b"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#sea)"/><path d="M-80 710 Q220 545 515 700 T1100 700 M-80 770 Q220 605 515 760 T1100 760 M-80 830 Q220 665 515 820 T1100 820" fill="none" stroke="#8de1d0" stroke-opacity=".16" stroke-width="5"/><circle cx="800" cy="170" r="400" fill="none" stroke="#bfe4c3" stroke-opacity=".09" stroke-width="2"/></svg>`);
  const mark = await sharp(logo).resize({ width: logoWidth }).png().toBuffer();
  return sharp(background).composite([{ input: mark, gravity: "center" }]).flatten({ background: "#061b2b" }).png();
}

await (await brandedSquare(1024, 820)).toFile(path.join(catalog, "AppIcon.appiconset/AppIcon-512@2x.png"));
for (const filename of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await (await brandedSquare(2732, 950)).toFile(path.join(catalog, "Splash.imageset", filename));
}
console.log("Exported SeaRealm app icon and launch artwork.");
