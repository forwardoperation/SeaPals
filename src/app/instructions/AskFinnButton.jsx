"use client";

export default function AskFinnButton({ className = "", children = "Ask Finn" }) {
  const openFinn = () => {
    document
      .querySelector('[aria-label="Open SeaPals rules chat"]')
      ?.click();
  };

  return (
    <button type="button" onClick={openFinn} className={className}>
      {children}
    </button>
  );
}
