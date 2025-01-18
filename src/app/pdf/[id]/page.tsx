'use client';

import { PDFViewer } from '@/components/PDFViewer';
import { usePDF } from '@/context/PDFContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PDFViewerPage() {
  const { id } = useParams();
  const { getDocument } = usePDF();
  const router = useRouter();

  const document = getDocument(id as string);

  return (
    <>
      <div className="p-2 pb-2 border-b border-offbase">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center px-3 py-1 bg-base text-foreground rounded-lg hover:bg-offbase transition-colors"
          >
            <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Documents
          </Link>
          <h1 className="mr-2 text-xl font-semibold text-foreground">{document?.name}</h1>
        </div>
      </div>
      <PDFViewer pdfFile={document?.data} />
    </>
  );    
}
