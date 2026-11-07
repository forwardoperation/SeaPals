import Image from "next/image";
import Link from "next/link";
import { prebuiltDecks } from "@/data/decks/prebuiltDecks";

export default function DeckLineupBanner({ compact = false }) {
  return (
    <ul
      aria-label="Ready-to-play deck lineup"
      className={`grid grid-cols-4 gap-2 bg-gradient-to-br from-[#063b50] to-[#051e31] p-3 text-white sm:gap-3 sm:p-4 ${compact ? "" : "lg:grid-cols-7"}`}
    >
      {prebuiltDecks.map((deck) => (
        <li key={deck.id} className="min-w-0">
          <Link
            href={`/decks#${deck.id}`}
            className="flex h-full flex-col items-center rounded-xl border border-white/10 bg-white/5 px-1 py-3 text-center transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          >
            <Image
              src={deck.image}
              alt=""
              width={90}
              height={126}
              className="h-24 w-auto max-w-full rounded-md object-contain shadow-lg sm:h-28"
            />
            <span className="mt-3 text-xs font-bold leading-snug">{deck.name}</span>
            <span className="mt-1 text-[10px] text-cyan-100/70">60 cards</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
