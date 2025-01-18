'use client';

import { PDFProvider } from '@/context/PDFContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <PDFProvider>{children}</PDFProvider>;
}
