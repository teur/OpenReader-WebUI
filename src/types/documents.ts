export type DocumentType = 'pdf' | 'epub' | 'docx' | 'html';

export interface BaseDocument {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  type: DocumentType;
  folderId?: string;
  isConverting?: boolean;
}

export interface PDFDocument extends BaseDocument {
  type: 'pdf';
  data: ArrayBuffer;
}

export interface HTMLDocument extends BaseDocument {
  type: 'html';
  data: string; // Store as string since it's text content
}

export interface EPUBDocument extends BaseDocument {
  type: 'epub';
  data: ArrayBuffer;
}

export interface DOCXDocument extends BaseDocument {
  type: 'docx';
  data: ArrayBuffer;
}

export interface DocumentListDocument extends BaseDocument {
  type: DocumentType;
}

export interface Folder {
  id: string;
  name: string;
  documents: DocumentListDocument[];
}

export type SortBy = 'name' | 'type' | 'date' | 'size';
export type SortDirection = 'asc' | 'desc';

export interface DocumentListState {
  sortBy: SortBy;
  sortDirection: SortDirection;
  folders: Folder[];
  collapsedFolders: string[];
  showHint: boolean;
}
