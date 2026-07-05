"use client";

import { useState } from "react";

export function ExportCfoReportButton() {
  const [isPrinting, setIsPrinting] = useState(false);

  function handlePrint() {
    setIsPrinting(true);

    window.setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={isPrinting}
      className="btn-ghost no-print"
      style={{
        whiteSpace: "nowrap",
        opacity: isPrinting ? 0.7 : 1,
        cursor: isPrinting ? "not-allowed" : "pointer",
      }}
    >
      {isPrinting ? "Preparing PDF..." : "Export / Print PDF"}
    </button>
  );
}