import { getStudentRegister } from "@/lib/students/register";

type Row = {
  studentNumber: string;
  name: string;
  nativeName: string;
  program: string;
  group: string;
  joinedOn: string;
  status: string;
};

export async function getStudentExportRows(locale: string): Promise<Row[]> {
  const first = await getStudentRegister({ locale, page: 1, pageSize: 500, status: "all" });
  if (first.total > 10_000) throw new Error("Student export is limited to 10,000 records per file.");
  const pages = [first];
  for (let page = 2; page <= first.pages; page += 1) {
    pages.push(await getStudentRegister({ locale, page, pageSize: 500, status: "all" }));
  }
  return pages.flatMap((result) => result.rows.map((row) => ({
    studentNumber: row.studentNumber,
    name: row.name,
    nativeName: row.nativeName ?? "",
    program: row.program === "—" ? "" : row.program,
    group: row.group === "—" ? "" : row.group,
    joinedOn: row.joinedOn ?? "",
    status: row.status
  })));
}
