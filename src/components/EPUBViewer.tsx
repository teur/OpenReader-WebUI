'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEPUB } from '@/contexts/EPUBContext';
import { useTTS } from '@/contexts/TTSContext';
import { useConfig } from '@/contexts/ConfigContext';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';
import TTSPlayer from '@/components/player/TTSPlayer';
import { setLastDocumentLocation } from '@/utils/indexedDB';
import type { Rendition, Book, NavItem } from 'epubjs';
import { useEPUBTheme, getThemeStyles } from '@/hooks/useEPUBTheme';

const ReactReader = dynamic(() => import('react-reader').then(mod => mod.ReactReader), {
  ssr: false,
  loading: () => <DocumentSkeleton />
});

interface EPUBViewerProps {
  className?: string;
}

export function EPUBViewer({ className = '' }: EPUBViewerProps) {
  const { id } = useParams();
  const { currDocData, currDocName, currDocPage, extractPageText } = useEPUB();
  const { skipToLocation, registerLocationChangeHandler, setIsEPUB } = useTTS();
  const { epubTheme } = useConfig();
  const bookRef = useRef<Book | null>(null);
  const rendition = useRef<Rendition | undefined>(undefined);
  const toc = useRef<NavItem[]>([]);
  const locationRef = useRef<string | number>(currDocPage);
  const { updateTheme } = useEPUBTheme(epubTheme, rendition.current);

  const isEPUBSetOnce = useRef(false);
  const handleLocationChanged = useCallback((location: string | number) => {
    // Set the EPUB flag once the location changes
    if (!isEPUBSetOnce.current) {
      setIsEPUB(true);
      isEPUBSetOnce.current = true;

      rendition.current?.display(location.toString());

      return;
    }

    if (!bookRef.current?.isOpen || !rendition.current) return;

    // Handle special 'next' and 'prev' cases
    if (location === 'next' && rendition.current) {
      rendition.current.next();
      return;
    }
    if (location === 'prev' && rendition.current) {
      rendition.current.prev();
      return;
    }

    // Save the location to IndexedDB if not initial
    if (id && locationRef.current !== 1) {
      console.log('Saving location:', location);
      setLastDocumentLocation(id as string, location.toString());
    }

    skipToLocation(location);

    locationRef.current = location;
    extractPageText(bookRef.current, rendition.current);

  }, [id, skipToLocation, extractPageText, setIsEPUB]);

  // Replace the debounced text extraction with a proper implementation using useMemo
  const debouncedExtractText = useMemo(() => {
    let timeout: NodeJS.Timeout;
    return (book: Book, rendition: Rendition) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        extractPageText(book, rendition);
      }, 150);
    };
  }, [extractPageText]);

  // Load the initial location and setup resize handler
  useEffect(() => {
    if (!bookRef.current || !rendition.current || isEPUBSetOnce.current) return;

    extractPageText(bookRef.current, rendition.current);

    // Add resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (bookRef.current && rendition.current) {
        debouncedExtractText(bookRef.current, rendition.current);
      }
    });

    // Observe the container element
    const container = document.querySelector('.epub-container');
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [extractPageText, debouncedExtractText]);

  // Register the location change handler
  useEffect(() => {
    registerLocationChangeHandler(handleLocationChanged);
  }, [registerLocationChangeHandler, handleLocationChanged]);

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
          key={'epub-reader'}
          location={locationRef.current}
          locationChanged={handleLocationChanged}
          url={currDocData}
          title={currDocName}
          tocChanged={(_toc) => (toc.current = _toc)}
          showToc={true}
          readerStyles={epubTheme && getThemeStyles() || undefined}
          getRendition={(_rendition: Rendition) => {
            bookRef.current = _rendition.book;
            rendition.current = _rendition;
            updateTheme();
          }}
        />
      </div>
    </div>
  );
}