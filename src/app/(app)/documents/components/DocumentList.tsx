import type { DocumentListItem } from "@/lib/documents";
import { DocumentRow } from "./DocumentRow";

export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  if (documents.length === 0) {
    return (
      <div className="documents-empty">
        <p className="section-title">No documents yet</p>
        <p className="section-hint">
          Upload a bank statement or invoice to get started — it&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="documents-list">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </ul>
  );
}
