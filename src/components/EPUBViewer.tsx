'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEPUB } from '@/contexts/EPUBContext';
import { useTTS } from '@/contexts/TTSContext';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';
import TTSPlayer from '@/components/player/TTSPlayer';
import { setLastDocumentLocation } from '@/utils/indexedDB';
import type { Rendition, Book, NavItem } from 'epubjs';
import { ReactReaderStyle, type IReactReaderStyle } from 'react-reader';
import { useConfig } from '@/contexts/ConfigContext';

const ReactReader = dynamic(() => import('react-reader').then(mod => mod.ReactReader), {
  ssr: false,
  loading: () => <DocumentSkeleton />
});

const colors = {
  background: getComputedStyle(document.documentElement).getPropertyValue('--background'),
  foreground: getComputedStyle(document.documentElement).getPropertyValue('--foreground'),
  base: getComputedStyle(document.documentElement).getPropertyValue('--base'),
  offbase: getComputedStyle(document.documentElement).getPropertyValue('--offbase'),
  muted: getComputedStyle(document.documentElement).getPropertyValue('--muted'),
};

const getThemeStyles = (): IReactReaderStyle => {
  const baseStyle = {
    ...ReactReaderStyle,
    readerArea: {
      ...ReactReaderStyle.readerArea,
      transition: undefined,
    }
  };

  return {
    ...baseStyle,
    arrow: {
      ...baseStyle.arrow,
      color: colors.foreground,
    },
    arrowHover: {
      ...baseStyle.arrowHover,
      color: colors.muted,
    },
    readerArea: {
      ...baseStyle.readerArea,
      backgroundColor: colors.base,
    },
    titleArea: {
      ...baseStyle.titleArea,
      color: colors.foreground,
      display: 'none',
    },
    tocArea: {
      ...baseStyle.tocArea,
      background: colors.base,
    },
    tocButtonExpanded: {
      ...baseStyle.tocButtonExpanded,
      background: colors.offbase,
    },
    tocButtonBar: {
      ...baseStyle.tocButtonBar,
      background: colors.muted,
    },
    tocButton: {
      ...baseStyle.tocButton,
      color: colors.muted,
    },
    tocAreaButton: {
      ...baseStyle.tocAreaButton,
      color: colors.muted,
      backgroundColor: colors.offbase,
      padding: '0.25rem',
      paddingLeft: '0.5rem',
      paddingRight: '0.5rem',
      marginBottom: '0.25rem',
      borderRadius: '0.25rem',
      borderColor: 'transparent',
    },
  };
};

interface EPUBViewerProps {
  className?: string;
}

export function EPUBViewer({ className = '' }: EPUBViewerProps) {
  const { id } = useParams();
  const { currDocData, currDocName, currDocPage, extractPageText } = useEPUB();
  const { setEPUBPageInChapter, registerLocationChangeHandler } = useTTS();
  const { epubTheme } = useConfig();
  const bookRef = useRef<Book | null>(null);
  const rendition = useRef<Rendition | undefined>(undefined);
  const toc = useRef<NavItem[]>([]);
  const locationRef = useRef<string | number>(currDocPage);
  const [reloadKey, setReloadKey] = useState(0);
  const [initialPrevLocLoad, setInitialPrevLocLoad] = useState(false);

  const handleLocationChanged = useCallback((location: string | number, initial = false) => {
    if (!bookRef.current?.isOpen) return;
    // Handle special 'next' and 'prev' cases, which 
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
      
      // Add a small delay for initial load to ensure rendition is ready
      if (initial) {
        setInitialPrevLocLoad(true);
      } else {
        extractPageText(bookRef.current, rendition.current);
      }
    }
  }, [id, setEPUBPageInChapter, extractPageText]);

  // Load the initial location
  useEffect(() => {
    if (bookRef.current && rendition.current) {
      extractPageText(bookRef.current, rendition.current);
    }
  }, [extractPageText, initialPrevLocLoad]);

  const updateTheme = useCallback((rendition: Rendition) => {
    if (!epubTheme) return; // Only apply theme if enabled
    
    rendition.themes.override('color', colors.foreground);
    rendition.themes.override('background', colors.base);
  }, [epubTheme]);

  // Watch for theme changes
  useEffect(() => {
    if (!epubTheme || !bookRef.current?.isOpen || !rendition.current) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          if (epubTheme) {
            setReloadKey(prev => prev + 1);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [epubTheme]);

  // Watch for epubTheme changes
  useEffect(() => {
    if (!epubTheme || !bookRef.current?.isOpen || !rendition.current) return;
    setReloadKey(prev => prev + 1);
  }, [epubTheme]);

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
          key={reloadKey} // Add this line to force remount
          location={locationRef.current}
          locationChanged={handleLocationChanged}
          url={currDocData}
          title={currDocName}
          tocChanged={(_toc) => (toc.current = _toc)}
          showToc={true}
          readerStyles={epubTheme && getThemeStyles() || undefined}
          getRendition={(_rendition: Rendition) => {
            updateTheme(_rendition);

            bookRef.current = _rendition.book;
            rendition.current = _rendition;
          }}
        />
      </div>
    </div>
  );
}