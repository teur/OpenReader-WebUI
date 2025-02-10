'use client';

import dynamic from 'next/dynamic';
import { usePDF } from '@/contexts/PDFContext';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';
import { useTTS } from '@/contexts/TTSContext';
import { Button } from '@headlessui/react';
import { DocumentSettings } from '@/components/DocumentSettings';
import { SettingsIcon } from '@/components/icons/Icons';

// Dynamic import for client-side rendering only
const PDFViewer = dynamic(
  () => import('@/components/PDFViewer').then((module) => module.PDFViewer),
  { 
    ssr: false,
    loading: () => <DocumentSkeleton />
  }
);

export default function PDFViewerPage() {
  const { id } = useParams();
  const { setCurrentDocument, currDocName, clearCurrDoc } = usePDF();
  const { stop } = useTTS();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const loadDocument = useCallback(async () => {
    if (!isLoading) return; // Prevent calls when not loading new doc
    console.log('Loading new document (from page.tsx)');
    stop(); // Reset TTS when loading new document
    try {
      if (!id) {
        setError('Document not found');
        return;
      }
      setCurrentDocument(id as string);
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Failed to load document');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, id, setCurrentDocument, stop]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 300));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 50));

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error}</p>
        <Link
          href="/"
          onClick={() => {clearCurrDoc();}}
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
      <div className="p-2 pb-2 border-b border-offbase">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              onClick={() => {clearCurrDoc();}}
              className="inline-flex items-center px-3 py-1 bg-base text-foreground rounded-lg hover:bg-offbase transform transition-transform duration-200 ease-in-out hover:scale-[1.02]"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Documents
            </Link>
            <div className="bg-offbase px-2 py-0.5 rounded-full flex items-center gap-2">
              <Button
                onClick={handleZoomOut}
                className="text-xs transform transition-transform duration-200 ease-in-out hover:scale-[1.45] hover:font-semibold hover:text-accent"
                aria-label="Zoom out"
              >
                －
              </Button>
              <span className="text-xs">{zoomLevel}%</span>
              <Button
                onClick={handleZoomIn}
                className="text-xs transform transition-transform duration-200 ease-in-out hover:scale-[1.45] hover:font-semibold hover:text-accent"
                aria-label="Zoom in"
              >
                ＋
              </Button>
            </div>
            <Button
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-full p-1 text-foreground hover:bg-offbase transform transition-transform duration-200 ease-in-out hover:scale-[1.1] hover:text-accent"
              aria-label="View Settings"
            >
              <SettingsIcon className="w-5 h-5 hover:animate-spin-slow" />
            </Button>
          </div>
          <h1 className="ml-2 mr-2 text-md font-semibold text-foreground truncate">
            {isLoading ? 'Loading...' : currDocName}
          </h1>
        </div>
      </div>
      {isLoading ? (
        <div className="p-4">
          <DocumentSkeleton />
        </div>
      ) : (
        <PDFViewer zoomLevel={zoomLevel} />
      )}
      <DocumentSettings isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </>
  );
}
