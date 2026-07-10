"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { cardsById } from "@/data/cards";

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

function sampleDeck() {
  const ids = Object.keys(cardsById).slice(0, 24);
  return shuffle(ids);
}

export default function Simulator() {
  const [playerDeck, setPlayerDeck] = useState(() => sampleDeck());
  const [opponentDeck] = useState(() => sampleDeck());
  const [hand, setHand] = useState([]);
  const [playerBoard, setPlayerBoard] = useState([]);
  const [opponentBoard, setOpponentBoard] = useState([]);
  const [log, setLog] = useState(["Simulator ready."]);
  const [turn, setTurn] = useState(1);
  const [phase, setPhase] = useState("choose");
  const [selectedCard, setSelectedCard] = useState(null);
  const [rp, setRp] = useState(3);
  const [showHandModal, setShowHandModal] = useState(false);
  const [transition, setTransition] = useState(null);

  useEffect(() => {
    // draw opening hand
    draw(5);
    // opponent plays a simple active Pokemon
    const opp = opponentDeck[0];
    setOpponentBoard([{ id: opp, hp: Number(cardsById[opp]?.health ?? 30), active: true }]);
  }, []);

  function pushLog(text) {
    setLog((l) => [text, ...l].slice(0, 50));
  }

  function draw(n = 1) {
    setPlayerDeck((deck) => {
      const taken = deck.slice(0, n);
      const rest = deck.slice(n);
      setHand((h) => [...h, ...taken]);
      if (taken.length) pushLog(`Drew ${taken.length} card(s).`);
      return rest;
    });
  }

  function playCard(cardId) {
    const card = cardsById[cardId] || { name: cardId };
    setHand((h) => h.filter((c) => c !== cardId));
    // simple placement: if creature put to board, else treat as support
    setPlayerBoard((b) => [...b, { id: cardId, hp: Number(card.health ?? 30), active: true }]);
    // pay cost if present
    if (card.cost?.rp) {
      setRp((r) => Math.max(0, r - Number(card.cost.rp)));
      pushLog(`Paid ${card.cost.rp} RP to play ${card.name}.`);
    } else {
      pushLog(`Played ${card.name}.`);
    }
  }

  function attack(attackerIndex, targetIndex) {
    const attacker = playerBoard[attackerIndex];
    const target = opponentBoard[targetIndex];
    if (!attacker || !target) return;
    const atk = Number(cardsById[attacker.id]?.attackDamage ?? 10) || 10;
    const remaining = (target.hp ?? 30) - atk;
    setOpponentBoard((b) => b.map((e, i) => (i === targetIndex ? { ...e, hp: remaining } : e)));
    pushLog(`${cardsById[attacker.id]?.name ?? attacker.id} attacked for ${atk} damage.`);
    // visual transition
    setTransition(`${cardsById[attacker.id]?.name ?? attacker.id} attacks!`);
    setTimeout(() => setTransition(null), 700);
    if (remaining <= 0) {
      pushLog(`${cardsById[target.id]?.name ?? target.id} was knocked out.`);
      setOpponentBoard((b) => b.filter((_, i) => i !== targetIndex));
    }
  }

  function endTurn() {
    setTurn((t) => t + 1);
    setPhase("choose");
    pushLog(`Turn ${turn} ended. Opponent's turn briefly simulated.`);
    setTransition("Opponent's Turn...");
    setTimeout(() => setTransition(null), 800);
    // simple opponent play: draw and play first in deck
    setTimeout(() => {
      const oppCard = opponentDeck[1];
      if (oppCard) {
        setOpponentBoard((b) => [...b, { id: oppCard, hp: Number(cardsById[oppCard]?.health ?? 30) }]);
        pushLog(`Opponent played ${cardsById[oppCard]?.name ?? oppCard}.`);
      }
    }, 600);
  }

  function activateAction(cardId, action) {
    const card = cardsById[cardId];
    if (!action) return;
    const cost = action.cost?.rp ?? 0;
    if (rp < cost) {
      pushLog(`Not enough RP to use ${action.name}.`);
      return;
    }
    // pay cost
    setRp((r) => r - cost);
    pushLog(`Activated ${action.name} on ${card.name} (cost ${cost} RP).`);
    // show transition and apply basic effect simulation
    setTransition(`${card.name} uses ${action.name}!`);
    setTimeout(() => setTransition(null), 900);
    // naive effect handling: if action has effects array, handle simple damage to opponent coral/creatures
    if (action.effects && Array.isArray(action.effects)) {
      for (const eff of action.effects) {
        if (eff.type === "DAMAGE") {
          // apply to first opponent creature if exists
          setOpponentBoard((b) => {
            if (!b.length) return b;
            const idx = 0;
            const amt = eff.amount?.value ?? 10;
            const newHp = (b[idx].hp ?? 30) - amt;
            pushLog(`${cardsById[cardId]?.name} deals ${amt} damage.`);
            if (newHp <= 0) {
              pushLog(`${cardsById[b[idx].id]?.name} was knocked out.`);
              return b.slice(1);
            }
            return b.map((x, i) => (i === idx ? { ...x, hp: newHp } : x));
          });
        }
      }
    }
  }

  const handCards = useMemo(() => hand.map((id) => ({ id, card: cardsById[id] })), [hand]);

  return (
    <main className="grid gap-6 md:grid-cols-3">
      <section className="md:col-span-2">
          <div className="mb-4 rounded border bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Player Area — Turn {turn}</h2>
            <div className="text-sm font-bold">RP: {rp}</div>
          </div>
          <div className="mt-3 grid gap-3">
            <div>
              <h3 className="font-bold">Your Board</h3>
              <div className="mt-2 flex gap-3">
                {playerBoard.length ? (
                  playerBoard.map((p, i) => (
                    <div key={`${p.id}-${i}`} className="w-40 rounded border p-2 cursor-pointer" onClick={() => setSelectedCard(p.id)}>
                      <div className="font-bold">{cardsById[p.id]?.name ?? p.id}</div>
                      <div className="text-sm">HP: {p.hp}</div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); attack(i, 0); }} className="rounded border px-2 text-sm">Attack Opponent</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded border p-2">No cards in play</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold">Opponent Board</h3>
              <div className="mt-2 flex gap-3">
                {opponentBoard.length ? (
                  opponentBoard.map((p, i) => (
                    <div key={`${p.id}-${i}`} className="w-40 rounded border p-2 cursor-pointer" onClick={() => setSelectedCard(p.id)}>
                      <div className="font-bold">{cardsById[p.id]?.name ?? p.id}</div>
                      <div className="text-sm">HP: {p.hp}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded border p-2">No opponent cards</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded border bg-white p-4 shadow">
          <h3 className="font-bold">Hand ({hand.length})</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {handCards.map((h) => (
              <div key={h.id} className="rounded border p-2">
                <div className="font-bold">{h.card?.name ?? h.id}</div>
                <div className="text-sm">{h.card?.subtitle ?? ""}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setSelectedCard(h.id)} className="rounded border px-2 text-sm">Read</button>
                  <button onClick={() => playCard(h.id)} className="rounded border px-2 text-sm">Play</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside>
        <div className="sticky top-6 space-y-4">
          <div className="rounded border bg-white p-4 shadow">
            <h4 className="font-bold">Actions</h4>
            <div className="mt-3 grid gap-2">
              <button onClick={() => draw(1)} className="rounded border px-3 py-2 text-sm">Draw</button>
              <button onClick={() => draw(3)} className="rounded border px-3 py-2 text-sm">Draw 3</button>
              <button onClick={endTurn} className="rounded bg-rose-600 px-3 py-2 text-sm font-bold text-white">End Turn</button>
            </div>
          </div>

          <div className="rounded border bg-white p-4 shadow">
            <h4 className="font-bold">Log</h4>
            <div className="mt-2 max-h-48 overflow-auto text-sm">
              {log.map((l, i) => (
                <div key={`${l}-${i}`} className="border-b py-1">{l}</div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {showHandModal ? (
        <div className="fixed left-0 top-0 z-40 flex h-full w-full items-center justify-center bg-black/30">
          <div className="max-w-3xl rounded bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Your Hand</h3>
              <div>
                <button onClick={() => setShowHandModal(false)} className="rounded border px-3 py-1">Close</button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {handCards.map((h) => (
                <div key={h.id} className="rounded border p-2">
                  <div className="font-bold">{h.card?.name ?? h.id}</div>
                  <div className="text-sm">{h.card?.subtitle ?? ""}</div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => setSelectedCard(h.id)} className="rounded border px-2 text-sm">Read</button>
                    <button onClick={() => { playCard(h.id); setShowHandModal(false); }} className="rounded border px-2 text-sm">Play</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selectedCard ? (
        <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black/40">
          <div className="max-w-xl rounded bg-white p-6 shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">{cardsById[selectedCard]?.name ?? selectedCard}</h3>
                <p className="mt-2 text-sm">{cardsById[selectedCard]?.text ?? "No description."}</p>
                <div className="mt-3 text-sm text-slate-600">Cost: {cardsById[selectedCard]?.cost?.rp ?? 0} RP</div>
              </div>
              <div>
                <button onClick={() => setSelectedCard(null)} className="rounded border px-3 py-2">Close</button>
              </div>
            </div>

            {cardsById[selectedCard]?.actions?.length ? (
              <div className="mt-4">
                <h4 className="font-bold">Actions</h4>
                <div className="mt-2 grid gap-2">
                  {cardsById[selectedCard].actions.map((act) => (
                    <div key={act.id} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <div className="font-bold">{act.name}</div>
                        <div className="text-sm">{act.text}</div>
                      </div>
                      <div className="flex gap-2">
                        <div className="text-sm text-slate-600">Cost: {act.cost?.rp ?? 0} RP</div>
                        <button onClick={() => activateAction(selectedCard, act)} className="rounded bg-cyan-600 px-3 py-1 text-sm text-white">Activate</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { playCard(selectedCard); setSelectedCard(null); }} className="rounded bg-cyan-600 px-3 py-2 text-white">Play</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
