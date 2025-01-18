'use client';

import { PDFUploader } from '@/components/PDFUploader';
import { DocumentList } from '@/components/DocumentList';

export default function Home() {
  return (
    <div className="min-h-screen bg-background py-4">
      <div className="max-w-5xl mx-auto px-2">
        <div className="bg-base rounded-lg shadow-lg p-4">
          <h1 className="text-2xl font-bold mb-6 text-center">PDF Reader</h1>
          <div className="flex flex-col items-center gap-6">
            <PDFUploader className="w-full max-w-md" />
            <DocumentList />
          </div>
        </div>
      </div>
    </div>
  );
}
