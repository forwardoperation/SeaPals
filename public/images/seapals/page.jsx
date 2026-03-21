export default function SeaPalsPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-800">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold">Meet the SeaPals</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Learn about the real marine animals that inspire the SeaPals world.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-6">
            <h2 className="text-2xl font-semibold">Bull Shark</h2>
            <p className="mt-2 text-slate-600">
              A powerful and adaptable shark known for thriving in both saltwater and freshwater.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-6">
            <h2 className="text-2xl font-semibold">Blue Whale</h2>
            <p className="mt-2 text-slate-600">
              The largest animal on Earth, famous for its immense size and gentle nature.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}