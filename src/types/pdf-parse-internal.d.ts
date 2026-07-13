declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  };

  type PdfTextItem = {
    str?: string;
    transform?: number[];
    width?: number;
    height?: number;
  };

  type PdfPageData = {
    pageIndex?: number;
    getTextContent: (options?: {
      normalizeWhitespace?: boolean;
      disableCombineTextItems?: boolean;
    }) => Promise<{ items?: PdfTextItem[] }>;
  };

  type PdfParseOptions = {
    max?: number;
    version?: string;
    pagerender?: (pageData: PdfPageData) => Promise<string> | string;
  };

  const pdfParse: (
    dataBuffer: Buffer | Uint8Array,
    options?: PdfParseOptions,
  ) => Promise<PdfParseResult>;

  export default pdfParse;
}
