'use client';

import { ReactNode } from 'react';

import { DocumentProvider } from '@/contexts/DocumentContext';
import { PDFProvider } from '@/contexts/PDFContext';
import { EPUBProvider } from '@/contexts/EPUBContext';
import { TTSProvider } from '@/contexts/TTSContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { HTMLProvider } from '@/contexts/HTMLContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ConfigProvider>
        <DocumentProvider>
          <TTSProvider>
            <PDFProvider>
              <EPUBProvider>
                <HTMLProvider>
                  {children}
                </HTMLProvider>
              </EPUBProvider>
            </PDFProvider>
          </TTSProvider>
        </DocumentProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}
