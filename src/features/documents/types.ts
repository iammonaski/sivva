export type DocumentSection = {
  text: string;
  pageNumber: number | null;
  sectionHeading: string | null;
};

export type ExtractedDocument = {
  sections: DocumentSection[];
  pageCount: number;
};

export type DocumentChunk = DocumentSection & {
  chunkIndex: number;
  tokenCount: number;
};
