import Link from "next/link";

import {
  LEGAL_EFFECTIVE_DATE_ISO,
  LEGAL_EFFECTIVE_DATE_LABEL,
  SEAPALS_OPERATOR,
} from "@/lib/legalPrivacy.mjs";

import styles from "./LegalDocument.module.css";

export function LegalDocument({
  eyebrow,
  title,
  summary,
  children,
}) {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">
        ← Back to SeaPals
      </Link>

      <header className={styles.hero}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.summary}>{summary}</p>
        <p className={styles.updated}>
          Effective and last updated{" "}
          <time dateTime={LEGAL_EFFECTIVE_DATE_ISO}>
            {LEGAL_EFFECTIVE_DATE_LABEL}
          </time>
        </p>
      </header>

      <article className={styles.document}>{children}</article>
    </main>
  );
}

export function LegalNotice({ title, children }) {
  return (
    <section className={styles.notice}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalSection({ id, title, children }) {
  return (
    <section id={id} className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalTable({ headers, rows, caption }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) => (
                <td key={`${row[0]}-${index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OperatorContact() {
  return (
    <section className={styles.contact} id="contact">
      <h2>Operator and privacy contact</h2>
      <p>
        Questions, parent requests, account-deletion requests, and privacy
        concerns can be directed to:
      </p>
      <div className={styles.contactGrid}>
        <div className={styles.contactItem}>
          <strong>Operator</strong>
          <span>{SEAPALS_OPERATOR.legalName}</span>
        </div>
        <div className={styles.contactItem}>
          <strong>Email</strong>
          <span>
            <a href={`mailto:${SEAPALS_OPERATOR.privacyEmail}`}>
              {SEAPALS_OPERATOR.privacyEmail}
            </a>
          </span>
        </div>
        <div className={styles.contactItem}>
          <strong>Mail</strong>
          <address className={styles.address}>
            {SEAPALS_OPERATOR.mailingAddress.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
        </div>
        <div className={styles.contactItem}>
          <strong>Telephone</strong>
          <span>
            Sea Realm does not currently offer a public telephone support line.
            Email or mail may be used for all privacy requests.
          </span>
        </div>
      </div>
    </section>
  );
}
