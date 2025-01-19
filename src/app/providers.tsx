'use client';

import { PDFProvider } from '@/context/PDFContext';
import { TTSProvider } from '@/context/TTSContext';
import { ThemeProvider } from '@/context/ThemeContext';
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
