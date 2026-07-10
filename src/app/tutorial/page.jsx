import TutorialSimulator from "./TutorialSimulator";
import PokemonTutorial from "./PokemonTutorial";

export const metadata = {
  title: "Interactive Tutorial | SeaPals TCG",
  description:
    "Learn SeaPals through a guided 10 VP interactive tutorial game.",
};

export default function TutorialPage() {
  return (
    <div>
      <TutorialSimulator />
      <hr className="my-12 border-slate-200" />
      <section className="mb-6">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-700">Pokemon-style Tutorial</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Interactive Battle Flow (Pokemon-like)</h2>
      </section>
      <PokemonTutorial />
    </div>
  );
}
