'use client';

import { PDFUploader } from '@/components/PDFUploader';
import { DocumentList } from '@/components/DocumentList';

export default function Home() {
  return (
    <div className='p-4'>
      <h1 className="text-2xl font-bold mb-6 text-center">OpenReader WebUI</h1>
      <div className="flex flex-col items-center gap-6">
        <PDFUploader className="w-full max-w-md" />
        <DocumentList />
      </div>
    </div>
  );
}
