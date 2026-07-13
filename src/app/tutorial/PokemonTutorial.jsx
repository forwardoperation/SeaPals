"use client";

import { useState, useEffect } from "react";

const scenes = [
  { id: 0, title: "Player's Turn", text: "JAKE'S TURN.", prompt: 'Next' },
  { id: 1, title: "Draw", text: "YOU DREW DOUBLE COLORLESS ENERGY.", prompt: 'Attach' },
  { id: 2, title: "Attach Energy", text: "ATTACHED DOUBLE COLORLESS ENERGY TO DRAGONAIR.", prompt: 'Continue' },
  { id: 3, title: "Attack", text: "GROWLITHE LV18'S FLARE! 20 DAMAGE.", prompt: 'Damage' },
  { id: 4, title: "Damage", text: "GROWLITHE LV18 TOOK 20 DAMAGE.", prompt: 'Continue' },
  { id: 5, title: "Win", text: "YOU WON! THE DUEL WITH ADAM!", prompt: 'Restart', win: true },
];

export default function PokemonTutorial() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index]);

  function next() {
    const cur = scenes[index];
    if (cur.win) {
      setIndex(0);
    } else {
      setIndex((i) => Math.min(i + 1, scenes.length - 1));
    }
  }

  const scene = scenes[index];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 rounded-lg border bg-amber-50 p-4 text-center shadow-sm">
        <div className="inline-block rounded-md border bg-white px-6 py-3 text-lg font-bold shadow">{scene.title}</div>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-xl font-bold">{scene.text}</p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="w-40 rounded-lg border bg-slate-100 p-3 text-center">ENERGY CARD</div>
        <div className="flex-1 rounded-lg border bg-white p-4">
          <p className="font-mono text-sm">{scene.text}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="inline-flex items-center gap-2 rounded border px-4 py-2 text-sm"
        >
          Back
        </button>
        <button
          type="button"
          onClick={next}
          className="ml-auto inline-flex items-center gap-2 rounded bg-rose-600 px-4 py-2 text-sm font-bold text-white"
        >
          {scene.prompt}
        </button>
      </div>

      <style jsx>{`
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Segoe UI Mono'; }
      `}</style>
    </div>
  );
}
