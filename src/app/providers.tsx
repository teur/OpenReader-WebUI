'use client';

import { PDFProvider } from '@/context/PDFContext';
import { TTSProvider } from '@/context/TTSContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TTSProvider>
      <PDFProvider>
        {children}
      </PDFProvider>
    </TTSProvider>
  );
}
