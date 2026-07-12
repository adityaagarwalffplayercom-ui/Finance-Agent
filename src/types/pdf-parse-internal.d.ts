declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  };

  type PdfParseOptions = {
    max?: number;
    version?: string;
  };

  const pdfParse: (
    dataBuffer: Buffer | Uint8Array,
    options?: PdfParseOptions,
  ) => Promise<PdfParseResult>;

  export default pdfParse;
}
