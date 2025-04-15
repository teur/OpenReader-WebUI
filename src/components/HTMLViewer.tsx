'use client';

import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useHTML } from '@/contexts/HTMLContext';
import TTSPlayer from '@/components/player/TTSPlayer';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';

interface HTMLViewerProps {
  className?: string;
}

export function HTMLViewer({ className = '' }: HTMLViewerProps) {
  const { currDocData, currDocName } = useHTML();
  const containerRef = useRef<HTMLDivElement>(null);

  if (!currDocData) {
    return <DocumentSkeleton />;
  }

  // Check if the file is a txt file
  const isTxtFile = currDocName?.toLowerCase().endsWith('.txt');

  return (
    <div className={`h-screen flex flex-col ${className}`} ref={containerRef}>
      <div className="z-10">
        <TTSPlayer />
      </div>
      <div className="flex-1 overflow-auto">
        <div className={`min-w-full px-4 ${isTxtFile ? 'whitespace-pre-wrap font-mono text-sm' : 'prose prose-base'}`}>
          {isTxtFile ? (
            currDocData
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currDocData}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
