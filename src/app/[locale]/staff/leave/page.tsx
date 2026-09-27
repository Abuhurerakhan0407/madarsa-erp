import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";
import { hrCopy } from "@/lib/hr/copy";
import { getHrEmployees, getHrLeave } from "@/lib/hr/workspace";
import { HrLeaveWorkspace } from "@/components/hr-leave-workspace";

export default async function StaffLeavePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params; const locale: SupportedLocale = raw === "ur" ? "ur" : "en";
  await requireOfficeAudience(locale);
  const [data, employeesData] = await Promise.all([getHrLeave(), getHrEmployees({ state: "active", page: 1, pageSize: 100 })]);
  const t = hrCopy[locale]; const employees = employeesData.rows.map((employee) => ({ employmentId: employee.employmentId, employeeNumber: employee.employeeNumber, displayName: employee.displayName }));
  return <><section className="page-heading"><div><p className="state-kicker">{t.kicker}</p><h1>{t.leave}</h1><p>{t.body}</p></div></section><HrLeaveWorkspace locale={locale} data={data} employees={employees} /></>;
}
