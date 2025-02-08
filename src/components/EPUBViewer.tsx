'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useEPUB } from '@/contexts/EPUBContext';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';

const ReactReader = dynamic(() => import('react-reader').then(mod => mod.ReactReader), {
  ssr: false,
  loading: () => <DocumentSkeleton />
});

interface EPUBViewerProps {
  className?: string;
}

export function EPUBViewer({ className = '' }: EPUBViewerProps) {
  const { currDocData, currDocName } = useEPUB();  // Changed from currDocURL
  const [location, setLocation] = useState<string | number>(0);

  if (!currDocData) {
    return <DocumentSkeleton />;
  }

  return (
    <div style={{ height: '100vh' }} className={className}>
      <ReactReader
        location={location}
        locationChanged={setLocation}
        url={currDocData}  // ReactReader can accept ArrayBuffer directly
        title={currDocName}
        showToc={true}
      />
    </div>
  );
}