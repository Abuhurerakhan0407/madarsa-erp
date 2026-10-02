import { notFound } from "next/navigation";
import { StudentLifecycleCenter } from "@/components/student-lifecycle-center";
import { WorkspacePageHeader } from "@/components/workspace-ui";
import { routing } from "@/i18n/routing";
import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";
import { getStudentLifecycleCenter } from "@/lib/students/lifecycle";

const copy={
 en:{kicker:"Student lifecycle operations",title:"Import, Promotion & Renewal",body:"Run governed student imports and next-session planning without rewriting current-year history. Duplicate imports are held for review, and promotion or renewal creates planned future enrollments only.",back:"Back to students",nextSession:"Prepare next academic session",sourceSession:"Source session",sessionKey:"Session key",sessionLabel:"English label",startsOn:"Starts on",endsOn:"Ends on",prepare:"Prepare session",importTitle:"CSV student import",csvFile:"CSV file",placement:"Class / group",joinedOn:"Joining date",preview:"Preview",importAction:"Import students",rolloverTitle:"Promotion & renewal planning",mode:"Mode",targetSession:"Target session",targetGroup:"Target class / group",students:"Select",selectAll:"Select / clear all",promotion:"Promotion",renewal:"Renewal",plan:"Plan rollover",jobs:"Recent lifecycle jobs",none:"Nothing to show yet.",error:"Unable to update student lifecycle operations.",guardrail:"The next session is created as draft and current classes are cloned. Current enrollments are not closed by this step.",rows:"rows",created:"created",blocked:"blocked",failed:"failed",planned:"planned"},
 ur:{kicker:"طلبہ لائف سائیکل آپریشنز",title:"امپورٹ، پروموشن و رینیول",body:"موجودہ تعلیمی سال کی تاریخ بدلے بغیر طلبہ امپورٹ اور اگلے سیشن کی منصوبہ بندی کریں۔ مشتبہ ڈپلیکیٹس ریویو کے لیے روکے جاتے ہیں اور پروموشن/رینیول صرف مستقبل کی planned enrollment بناتی ہے۔",back:"طلبہ پر واپس",nextSession:"اگلا تعلیمی سیشن تیار کریں",sourceSession:"موجودہ سیشن",sessionKey:"سیشن کلید",sessionLabel:"انگریزی نام",startsOn:"شروع",endsOn:"اختتام",prepare:"سیشن تیار کریں",importTitle:"CSV طالب علم امپورٹ",csvFile:"CSV فائل",placement:"کلاس / گروپ",joinedOn:"داخلہ تاریخ",preview:"پری ویو",importAction:"طلبہ امپورٹ کریں",rolloverTitle:"پروموشن و رینیول پلان",mode:"موڈ",targetSession:"اگلا سیشن",targetGroup:"اگلی کلاس / گروپ",students:"منتخب کریں",selectAll:"سب منتخب / صاف",promotion:"پروموشن",renewal:"رینیول",plan:"رول اوور پلان کریں",jobs:"حالیہ لائف سائیکل جابز",none:"ابھی کوئی ریکارڈ نہیں۔",error:"طلبہ لائف سائیکل آپریشن اپ ڈیٹ نہیں ہو سکا۔",guardrail:"اگلا سیشن draft بنتا ہے اور موجودہ کلاسیں clone ہوتی ہیں۔ اس مرحلے پر موجودہ enrollment بند نہیں کی جاتی۔",rows:"قطاریں",created:"بنائے گئے",blocked:"روکے گئے",failed:"ناکام",planned:"پلان"}
} as const;

type PageProps={params:Promise<{locale:string}>};

export default async function StudentLifecyclePage({params}:PageProps){
 const{locale:rawLocale}=await params;if(!routing.locales.includes(rawLocale as SupportedLocale))notFound();const locale:SupportedLocale=rawLocale==="ur"?"ur":"en";await requireOfficeAudience(locale);const data=await getStudentLifecycleCenter();const t=copy[locale];
 return <><WorkspacePageHeader eyebrow={t.kicker} title={t.title} description={t.body} meta={`${data.students.length} students`} actions={[{label:t.back,href:`/${locale}/students`}]}/><StudentLifecycleCenter data={data} copy={t}/></>;
}
