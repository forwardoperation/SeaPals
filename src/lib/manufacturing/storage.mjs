export const ARTWORK_BUCKET = "searealm-manufacturing-private";
// The public site never receives a storage credential, public URL, or signed URL.
export async function supabaseArtworkStore(admin) {
  let { data: configuration, error } =
    await admin.storage.getBucket(ARTWORK_BUCKET);
  if (error) {
    if (
      !["400", "404"].includes(String(error.statusCode)) ||
      !/not found/i.test(error.message)
    )
      throw new Error("Private storage is unavailable.");
    const created = await admin.storage.createBucket(ARTWORK_BUCKET, {
      public: false,
      fileSizeLimit: 30_000_000,
      allowedMimeTypes: ["image/png"],
    });
    if (created.error && !/already exists/i.test(created.error.message))
      throw new Error("Private storage could not be created.");
    const fetched = await admin.storage.getBucket(ARTWORK_BUCKET);
    configuration = fetched.data;
  }
  if (!configuration || configuration.public !== false)
    throw new Error("Manufacturing artwork must be in a private bucket.");
  const files = admin.storage.from(ARTWORK_BUCKET);
  return {
    async head(key) {
      const { data, error } = await files.info(key);
      if (error) {
        if (
          ["400", "404"].includes(String(error.statusCode)) &&
          /not found/i.test(error.message)
        )
          return null;
        throw new Error("Could not inspect private artwork.");
      }
      return { size: data.size, customMetadata: data.metadata };
    },
    async put(key, bytes, options) {
      const { error } = await files.upload(key, bytes, {
        upsert: false,
        contentType: "image/png",
        cacheControl: "0",
        metadata: options.customMetadata,
      });
      if (error && !/already exists|duplicate/i.test(error.message))
        throw new Error("Private artwork upload failed.");
    },
    async get(key) {
      const { data, error } = await files.download(key);
      if (error) throw new Error("Private artwork download failed.");
      return { size: data.size, body: data.stream() };
    },
  };
}
