"use client";

import { useEffect, useRef } from "react";
import styles from "./adventure.module.css";

export default function AdventureBaitShopModal({
  shop,
  notice = null,
  blocked = false,
  onPurchase,
  onClose,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || blocked) return undefined;
    const previousFocus = document.activeElement;
    const focusableSelector = "button:not(:disabled), [tabindex]:not([tabindex='-1'])";
    dialog.querySelector(focusableSelector)?.focus({ preventScroll: true });
    const trapFocus = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const modalStack = [...document.querySelectorAll("[data-adventure-modal='true']")];
      if (modalStack.at(-1) !== dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [blocked]);

  if (!shop) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      inert={blocked}
      aria-hidden={blocked || undefined}
      data-adventure-modal="true"
      className={styles.baitShopLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bait-shop-title"
    >
      <section className={styles.baitShopCard}>
        <header className={styles.baitShopHeader}>
          <div>
            <span>Henderson&apos;s counter</span>
            <h2 id="bait-shop-title">Elverson Bait &amp; Tackle</h2>
            <p>Pick a habitat-safe bait for the creatures you hope to observe, then place one pouch from your bait bag in the marked shallows.</p>
          </div>
          <div className={styles.baitShopBalance} aria-label={`${shop.creditBalance} Reef Credits available`}>
            <small>Reef Credits</small>
            <strong>{shop.creditBalance}</strong>
          </div>
          <button type="button" className={styles.baitShopClose} aria-label="Close bait and tackle shop" onClick={onClose}>Close</button>
        </header>

        {notice ? (
          <div
            className={`${styles.saveNotice} ${notice.kind === "error" ? styles.saveNoticeError : styles.saveNoticeInfo}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.message}
          </div>
        ) : null}

        <div className={styles.baitShopCatalog}>
          {shop.baits.map((bait) => {
            const affordable = shop.creditBalance >= bait.price;
            return (
              <article key={bait.id} className={styles.baitShopProduct} style={{ "--bait-color": bait.color }}>
                <span className={styles.baitShopPouch} aria-hidden="true"><i /><b /></span>
                <div className={styles.baitShopProductCopy}>
                  <span>{bait.targetLabel}</span>
                  <h3>{bait.name}</h3>
                  <p>{bait.description}</p>
                  <small>Draws matching creatures to feed for {Math.round(bait.durationMs / 1000)} seconds and gives the net a wider catch window.</small>
                </div>
                <div className={styles.baitShopProductAction}>
                  <b>{bait.quantity} owned</b>
                  <button
                    type="button"
                    disabled={!affordable}
                    onClick={() => onPurchase?.(bait.id)}
                  >
                    {affordable ? `Buy for ${bait.price}` : `Need ${bait.price} credits`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <footer className={styles.baitShopFooter}>
          <p><strong>Earn more Reef Credits:</strong> bring healthy catches to Mr. Easterling&apos;s aquarium care desk. Rarer field observations earn more.</p>
          <button type="button" onClick={onClose}>Done shopping</button>
        </footer>
      </section>
    </div>
  );
}
