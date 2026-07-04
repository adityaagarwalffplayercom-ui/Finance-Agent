import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDocumentsForUser } from "@/lib/documents";
import { UploadForm } from "./components/UploadForm";
import { DocumentList } from "./components/DocumentList";

export default async function DocumentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const documents = session?.user ? await getDocumentsForUser(session.user.id) : [];

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Business documents</p>
          <h1>Upload your financial documents</h1>
        </div>
      </header>

      <p className="page-intro">
        Bank statements, invoices, payroll, utility bills — anything that shows how money moves
        through the business. Once you&apos;ve uploaded a few, your finance team can start
        building the real picture.
      </p>

      <section className="documents-layout">
        <UploadForm />
        <DocumentList documents={documents} />
      </section>
    </>
  );
}
