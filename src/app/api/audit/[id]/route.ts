import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { clientIp, deleteAuditEntry, logAudit } from "@/lib/auditLogger";

/**
 * Audit log entry deletion endpoint.
 *
 * NOTE: (§2.7, §8.1) Owner-restricted endpoint allowing deletion of standard audit entries while safeguarding AUDIT_ENTRY_DELETED records from removal.
 */
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id } = await props.params;
  if (!(await deleteAuditEntry(id))) {
    return NextResponse.json(
      {
        error:
          "The entry was not found, or it records a deletion — those are never deleted, " +
          "or the journal could be emptied without a trace.",
      },
      { status: 409 },
    );
  }

  await logAudit({
    actor: owner.id,
    action: "AUDIT_ENTRY_DELETED",
    target: id,
    ip: clientIp(request),
  });

  return NextResponse.json({ success: true });
}

