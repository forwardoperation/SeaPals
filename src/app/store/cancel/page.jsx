import Link from "next/link";

export const metadata = {
  title: "Checkout canceled | SeaPals TCG",
  description: "Return to your saved SeaPals cart or keep browsing the store.",
};

export default function StoreCancelPage() {
  return (
    <main className="pb-16 md:pb-24">
      <section className="relative isolate mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-cyan-100 bg-white px-6 py-10 shadow-2xl shadow-cyan-950/10 sm:px-10 md:rounded-[2.75rem] md:px-14 md:py-14">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-cyan-200/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl"
        />

        <div className="relative">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-100 text-3xl font-black text-cyan-900"
          >
            {"<-"}
          </span>
          <p className="mt-7 text-sm font-black uppercase tracking-[0.2em] text-cyan-700">
            Checkout canceled
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Your cart is still waiting.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Checkout ended before completion. Your product selections remain saved
            on this device, so you can return whenever you are ready.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/store"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f7c948] px-6 py-3 font-black text-[#082f49] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
            >
              Return to cart
            </Link>
            <Link
              href="/decks"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-6 py-3 font-bold text-cyan-900 transition hover:-translate-y-0.5 hover:bg-cyan-100 focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
            >
              Compare deck lists
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
