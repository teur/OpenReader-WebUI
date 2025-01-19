'use client';

import { PDFProvider } from '@/contexts/PDFContext';
import { TTSProvider } from '@/contexts/TTSContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TTSProvider>
        <PDFProvider>
          {children}
        </PDFProvider>
      </TTSProvider>
    </ThemeProvider>
  );
}
