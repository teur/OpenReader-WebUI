'use client';

import { useState } from 'react';
import { PDFUploader } from '@/components/PDFUploader';
import { DocumentList } from '@/components/DocumentList';
import { SettingsModal } from '@/components/SettingsModal';
import { SettingsIcon } from '@/components/icons/Icons';

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className='p-4'>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-center flex-grow">OpenReader WebUI</h1>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="rounded-full p-2.5 text-foreground hover:bg-base focus:bg-base 
                   focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          aria-label="Settings"
        >
          <SettingsIcon className="w-6 h-6 hover:animate-spin-slow" />
        </button>
      </div>
      <div className="flex flex-col items-center gap-6">
        <PDFUploader className="w-full max-w-md" />
        <DocumentList />
      </div>
      <SettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </div>
  );
}
