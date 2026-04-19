export const metadata = {
  title: "How to Play | SeaPals TCG",
  description: "Read the SeaPals TCG instructions and learn how to play.",
};

const docId = "1k7GxLQC_imLxc6d9n_dxsq0CqQtJ0lPzwARsrBNLifA";
const embedUrl = `https://docs.google.com/document/d/${docId}/preview`;
const fullUrl = `https://docs.google.com/document/d/${docId}/edit?tab=t.0`;

export default function InstructionsPage() {
  return (
    <main className="py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            SeaPals TCG
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
            How to Play
          </h1>

          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Read the official SeaPals rules below.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-lg">
          <iframe
            src={embedUrl}
            title="SeaPals TCG Instructions"
            className="h-[80vh] w-full"
          />
        </div>

        <div className="mt-4">
          <a
            href={fullUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Open full instructions
          </a>
        </div>
      </div>
    </main>
  );
}