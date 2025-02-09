'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useEPUB } from '@/contexts/EPUBContext';
import { useTTS } from '@/contexts/TTSContext';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';
import TTSPlayer from '@/components/player/TTSPlayer';
import type { Rendition, Book, NavItem } from 'epubjs';

const ReactReader = dynamic(() => import('react-reader').then(mod => mod.ReactReader), {
  ssr: false,
  loading: () => <DocumentSkeleton />
});

interface EPUBViewerProps {
  className?: string;
}

export function EPUBViewer({ className = '' }: EPUBViewerProps) {
  const { currDocData, currDocName, currDocPage, currDocPages, extractPageText } = useEPUB();
  const { skipToLocation } = useTTS();
  const bookRef = useRef<Book | null>(null);
  const rendition = useRef<Rendition | undefined>(undefined);
  const toc = useRef<NavItem[]>([]);
  const locationRef = useRef<string | number>(currDocPage);

  const handleLocationChanged = async (location: string | number) => {
    if (bookRef.current && rendition.current) {
      const { displayed, href } = rendition.current.location.start
      const chapter = toc.current.find((item) => item.href === href)
      
      console.log('Displayed:', displayed, 'Chapter:', chapter);

      // Update the current location
      locationRef.current = location;
      // Skip to the current location in the TTS
      skipToLocation(displayed.page, displayed.total);

      // Extract text using the current rendition
      await extractPageText(bookRef.current, rendition.current);
    }
  };

  if (!currDocData) {
    return <DocumentSkeleton />;
  }

  return (
    <div className={`h-screen flex flex-col ${className}`}>
      <div className="z-10">
        <TTSPlayer />
      </div>
      <div className="flex-1 -mt-16 pt-16">
        <ReactReader
          location={locationRef.current}
          locationChanged={handleLocationChanged}
          url={currDocData}
          title={currDocName}
          tocChanged={(_toc) => (toc.current = _toc)}
          showToc={true}
          getRendition={(_rendition: Rendition) => {
            bookRef.current = _rendition.book;
            rendition.current = _rendition;
          }}
        />
      </div>
    </div>
  );
}