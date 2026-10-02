import { getMinimalFeesWorkspace } from "@/lib/fees/workspace";
import { MinimalFeesWorkspaceView } from "@/components/minimal-fees-workspace";

const copy = {
  en: { kicker: "Finance", title: "Fees & payments", body: "Create simple fees, assign them to a student or class, apply concessions, record payments and track outstanding balances." },
  ur: { kicker: "مالیات", title: "فیس اور ادائیگیاں", body: "سادہ فیس بنائیں، طالب علم یا کلاس کو مقرر کریں، رعایت لگائیں، ادائیگیاں درج کریں اور بقایا دیکھیں۔" }
} as const;

export default async function FeesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ur" ? "ur" : "en";
  const data = await getMinimalFeesWorkspace();
  const t = copy[locale];
  return <>
    <section className="page-heading"><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div></section>
    <MinimalFeesWorkspaceView locale={locale} data={data}/>
  </>;
}