'use client';

import { useParams } from "next/navigation";
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useHTML } from '@/contexts/HTMLContext';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';
import { HTMLViewer } from '@/components/HTMLViewer';
import { Button } from '@headlessui/react';
import { DocumentSettings } from '@/components/DocumentSettings';
import { SettingsIcon } from '@/components/icons/Icons';
import { useTTS } from "@/contexts/TTSContext";

export default function HTMLPage() {
  const { id } = useParams();
  const { setCurrentDocument, currDocName, clearCurrDoc } = useHTML();
  const { stop } = useTTS();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const loadDocument = useCallback(async () => {
    if (!isLoading) return;
    console.log('Loading new HTML document (from page.tsx)');
    stop();
    try {
      if (!id) {
        setError('Document not found');
        return;
      }
      await setCurrentDocument(id as string);
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error}</p>
        <Link
          href="/"
          onClick={() => {clearCurrDoc();}}
          className="inline-flex items-center px-3 py-1 bg-base text-foreground rounded-lg hover:bg-offbase transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="flex items-center gap-1">
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
        <HTMLViewer className="p-4" />
      )}
      <DocumentSettings html isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </>
  );
}
