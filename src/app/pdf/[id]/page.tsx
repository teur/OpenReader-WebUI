'use client';

import { PDFViewer } from '@/components/PDFViewer';
import { usePDF } from '@/context/PDFContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PDFSkeleton } from '@/components/PDFSkeleton';
import TTSPlayer from '@/components/TTSPlayer';
import { useTTS } from '@/context/TTSContext';

export default function PDFViewerPage() {
  const { id } = useParams();
  const { getDocument } = usePDF();
  const router = useRouter();
  const { setText, stop } = useTTS();
  const [document, setDocument] = useState<{ name: string; data: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDocument() {
      try {
        const doc = await getDocument(id as string);
        if (!doc) {
          setError('Document not found');
          return;
        }
        setDocument(doc);
      } catch (err) {
        console.error('Error loading document:', err);
        setError('Failed to load document');
      } finally {
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [id, getDocument]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error}</p>
        <Link
          href="/"
          onClick={() => {
            setText('');
            stop();
          }}
          className="inline-flex items-center px-3 py-1 bg-base text-foreground rounded-lg hover:bg-offbase transition-colors"
        >
          <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Documents
        </Link>
      </div>
    );
  }

  return (
    <>
      <TTSPlayer />
      <div className="p-2 pb-2 border-b border-offbase">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={() => {
              setText('');
              stop();
            }}
            className="inline-flex items-center px-3 py-1 bg-base text-foreground rounded-lg hover:bg-offbase transition-colors"
          >
            <svg className="w-4 h-4 mr-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Documents
          </Link>
          <h1 className="mr-2 text-xl font-semibold text-foreground">
            {isLoading ? 'Loading...' : document?.name}
          </h1>
        </div>
      </div>
      {isLoading ? (
        <div className="p-4">
          <PDFSkeleton />
        </div>
      ) : (
        <PDFViewer pdfData={document?.data} />
      )}
    </>
  );
}
