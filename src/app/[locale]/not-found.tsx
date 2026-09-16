import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import styles from "./not-found.module.css";

const copy = {
  en: {
    eyebrow: "ILMGAAH · 404",
    title: "Page not found",
    body: "This page does not exist, may have moved, or the link is no longer available.",
    dashboard: "Back to dashboard",
    students: "Open students",
    helpful: "Helpful links",
    helpfulBody: "Jump straight back into the areas you use most.",
    links: [
      ["Students", "Student records and profiles", "/students"],
      ["Admissions", "Walk-ins and applications", "/admissions"],
      ["Parent & Teacher Access", "Claims, access and notices", "/portals"],
      ["Teachers", "Teaching staff and attendance", "/staff"]
    ]
  },
  ur: {
    eyebrow: "ILMGAAH · 404",
    title: "صفحہ نہیں ملا",
    body: "یہ صفحہ موجود نہیں، منتقل ہو چکا ہے، یا یہ لنک اب دستیاب نہیں ہے۔",
    dashboard: "ڈیش بورڈ پر واپس جائیں",
    students: "طلبہ کھولیں",
    helpful: "فوری روابط",
    helpfulBody: "اپنے زیادہ استعمال ہونے والے حصوں میں براہ راست واپس جائیں۔",
    links: [
      ["طلبہ", "طلبہ کے ریکارڈ اور پروفائل", "/students"],
      ["داخلے", "واک اِن اور آن لائن درخواستیں", "/admissions"],
      ["والدین اور اساتذہ رسائی", "کلیم، رسائی اور اعلانات", "/portals"],
      ["اساتذہ", "اساتذہ اور حاضری", "/staff"]
    ]
  }
} as const;
export default async function NotFound() {
  const locale = await getLocale();
  const t = locale === "ur" ? copy.ur : copy.en;

  return (
    <section className={styles.shell} aria-labelledby="not-found-title">
      <div className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <div className={styles.code} aria-hidden="true">404</div>
          <h1 id="not-found-title">{t.title}</h1>
          <p className={styles.body}>{t.body}</p>
          <div className={styles.actions}>
            <Link className="action-button action-button-primary" href="/">{t.dashboard}</Link>
            <Link className="action-button" href="/students">{t.students}</Link>
          </div>
        </div>
        <div className={styles.visual} aria-hidden="true">
          <div className={styles.orbit} />
          <div className={styles.arch}>
            <div className={styles.sun} />
            <div className={styles.horizon} />
            <div className={styles.path} />
          </div>
          <span className={styles.visualMark}>I</span>
        </div>
      </div>
      <div className={styles.helpful}>
        <div className={styles.helpfulIntro}>
          <span>{t.helpful}</span>
          <p>{t.helpfulBody}</p>
        </div>
        <div className={styles.links}>
          {t.links.map(([label, description, href]) => (
            <Link className={styles.linkCard} href={href} key={href}>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
