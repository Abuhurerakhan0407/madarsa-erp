import { operatorHasPermissions } from "@/lib/access/operator-permission";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getStudentDetail } from "@/lib/students/detail";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

export type StudentLinkedDocument = {
  id: number;
  category: string;
  title: string;
  status: string;
  issuedOn: string | null;
  expiresOn: string | null;
  updatedAt: string;
  hasFile: boolean;
  fileName: string | null;
  version: number | null;
};

export type StudentDocumentStatus = {
  student: { personId: number; name: string; nativeName: string | null; studentNumber: string };
  documents: StudentLinkedDocument[];
};

type VersionRow = {
  document_id: number;
  version: number;
  file_name: string;
};

export async function getStudentDocumentStatus(
  personId: number,
  locale: SupportedLocale
): Promise<StudentDocumentStatus | null> {
  const workspace = await getTenantContext();
  if (!workspace?.branchId) return null;

  const [student, canReadDocuments] = await Promise.all([
    getStudentDetail(personId, locale),
    operatorHasPermissions(workspace, ["documents.file.read"])
  ]);
  if (!student || !canReadDocuments) return null;

  const admin = createAdminClient();
  const { data: links, error: linksError } = await admin
    .from("document_links")
    .select("document_id")
    .eq("tenant_id", workspace.tenantId)
    .eq("target_key", String(personId))
    .in("target_type", ["student", "person"]);
  if (linksError) throw new Error(`Unable to load student document links: ${linksError.message}`);

  const documentIds = [...new Set((links ?? []).map((row) => Number(row.document_id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!documentIds.length) {
    return { student: { personId, name: student.name, nativeName: student.nativeName, studentNumber: student.studentNumber }, documents: [] };
  }

  const [{ data: documents, error: documentsError }, { data: versions, error: versionsError }] = await Promise.all([
    admin
      .from("documents")
      .select("id,category,title,status,issued_on,expires_on,updated_at,branch_id")
      .eq("tenant_id", workspace.tenantId)
      .in("id", documentIds)
      .or(`branch_id.is.null,branch_id.eq.${workspace.branchId}`),
    admin
      .from("document_versions")
      .select("document_id,version,file_name")
      .eq("tenant_id", workspace.tenantId)
      .in("document_id", documentIds)
      .order("version", { ascending: false })
  ]);
  if (documentsError) throw new Error(`Unable to load student documents: ${documentsError.message}`);
  if (versionsError) throw new Error(`Unable to load student document versions: ${versionsError.message}`);

  const latestVersions = new Map<number, VersionRow>();
  for (const row of (versions ?? []) as VersionRow[]) {
    if (!latestVersions.has(row.document_id)) latestVersions.set(row.document_id, row);
  }

  const rows: StudentLinkedDocument[] = (documents ?? []).map((row) => {
    const version = latestVersions.get(Number(row.id));
    return {
      id: Number(row.id),
      category: String(row.category),
      title: String(row.title),
      status: String(row.status),
      issuedOn: typeof row.issued_on === "string" ? row.issued_on : null,
      expiresOn: typeof row.expires_on === "string" ? row.expires_on : null,
      updatedAt: String(row.updated_at),
      hasFile: Boolean(version),
      fileName: version?.file_name ?? null,
      version: version?.version ?? null
    };
  });
  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    student: { personId, name: student.name, nativeName: student.nativeName, studentNumber: student.studentNumber },
    documents: rows
  };
}
