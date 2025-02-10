'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEPUB } from '@/contexts/EPUBContext';
import { useTTS } from '@/contexts/TTSContext';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';
import TTSPlayer from '@/components/player/TTSPlayer';
import { setLastDocumentLocation } from '@/utils/indexedDB';
import type { Rendition, Book, NavItem } from 'epubjs';

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
  const { setEPUBPageInChapter, registerLocationChangeHandler } = useTTS();
  const bookRef = useRef<Book | null>(null);
  const rendition = useRef<Rendition | undefined>(undefined);
  const toc = useRef<NavItem[]>([]);
  const locationRef = useRef<string | number>(currDocPage);

  // Load the last location when component mounts
  // useEffect(() => {
  //   const loadLastLocation = async () => {
  //     if (id) {
  //       const lastLocation = await getLastDocumentLocation(id as string);
  //       if (lastLocation) {
  //         locationRef.current = lastLocation;
  //       }
  //     }
  //   };
  //   loadLastLocation();
  // }, [id]);

  const handleLocationChanged = useCallback((location: string | number) => {
    // Handle special 'next' and 'prev' cases
    if (location === 'next' && rendition.current) {
      rendition.current.next();
      return;
    }
    if (location === 'prev' && rendition.current) {
      rendition.current.prev();
      return;
    }

    if (bookRef.current && rendition.current) {
      const { displayed, href } = rendition.current.location.start;
      const chapter = toc.current.find((item) => item.href === href);
      
      console.log('Displayed:', displayed, 'Chapter:', chapter);


      if (locationRef.current !== 1) {
        // Save the location to IndexedDB
        if (id) {
          console.log('Saving location:', location);
          setLastDocumentLocation(id as string, location.toString());
        }
      }

      locationRef.current = location;
      
      setEPUBPageInChapter(displayed.page, displayed.total, chapter?.label || '');
      extractPageText(bookRef.current, rendition.current);
    }
  }, [id, setEPUBPageInChapter, extractPageText]);

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