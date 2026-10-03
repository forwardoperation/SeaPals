import { allCards } from "@/data/cards";
import galleryImages from "@/data/gallery-images.json";
import masterSetList from "@/data/gallery-set-list.json";
import { buildGalleryData } from "./galleryData.mjs";

export async function getGalleryData() {
  return buildGalleryData(masterSetList, galleryImages, allCards);
}
