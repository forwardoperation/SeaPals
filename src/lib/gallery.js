import fs from "fs/promises";
import path from "path";

const CATEGORY_CONFIG = [
  { slug: "filter-feeders", title: "Filter Feeders" },
  { slug: "apex", title: "Apex" },
  { slug: "predator", title: "Predator" },
  { slug: "fish", title: "Fish" },
  { slug: "invertebrates", title: "Invertebrates" },
  { slug: "coral", title: "Coral" },
];

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function prettifyFileName(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getImagesForCategory(categorySlug) {
  const categoryDir = path.join(
    process.cwd(),
    "public",
    "images",
    "cards",
    categorySlug
  );

  try {
    const entries = await fs.readdir(categoryDir, { withFileTypes: true });

    const images = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((fileName) =>
          IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase())
        )
        .sort((a, b) => a.localeCompare(b))
        .map(async (fileName) => {
          const baseName = fileName.replace(/\.[^/.]+$/, "");
          const jsonPath = path.join(categoryDir, `${baseName}.json`);

          let metadata = {};

          try {
            const jsonData = await fs.readFile(jsonPath, "utf-8");
            metadata = JSON.parse(jsonData);
          } catch {
            // No metadata file — totally fine
          }

          return {
            name: prettifyFileName(fileName),
            src: `/images/cards/${categorySlug}/${fileName}`,
            ...metadata,
          };
        })
    );

    return images;
  } catch {
    return [];
  }
}

export async function getGalleryData() {
  const categories = await Promise.all(
    CATEGORY_CONFIG.map(async (category) => ({
      ...category,
      images: await getImagesForCategory(category.slug),
    }))
  );

  return categories;
}