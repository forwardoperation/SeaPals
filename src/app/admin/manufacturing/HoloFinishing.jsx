export default function HoloFinishing({ holo, holoHandling, confirmed, disabled, onConfirmSticker, buttonClassName }) {
  const pullFinished = holoHandling === "pull-finished";
  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <p className="font-bold">{pullFinished ? "Pull finished holo" : "Holo sticker"}: {holo.name}</p>
      <p className="my-2 text-sm">
        Row {holo.row}, column {holo.column} ·{" "}
        {pullFinished ? `${holo.set === "ocean" ? "Oceanic" : holo.set} ${holo.collectorNumber}/${holo.setTotal}` : holo.printingId}
      </p>
      {pullFinished ? <p className="text-sm">Include this finished holo in the matching pack and discard the printed placeholder.</p> : <button
        className={buttonClassName}
        disabled={disabled || confirmed}
        onClick={onConfirmSticker}
      >{confirmed ? "Sticker applied ✓" : "Confirm sticker applied"}</button>}
    </div>
  );
}
