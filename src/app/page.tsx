'use client';

import { useState } from 'react';
import { PDFUploader } from '@/components/PDFUploader';
import { DocumentList } from '@/components/DocumentList';
import { SettingsModal } from '@/components/SettingsModal';
import { SettingsIcon } from '@/components/icons/Icons';

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className='p-3 md:p-5'>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-center flex-grow">OpenReader WebUI</h1>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="rounded-full p-2 text-foreground hover:bg-offbase transform transition-transform duration-200 ease-in-out hover:scale-[1.1] hover:text-accent"
          aria-label="Settings"
        >
          <SettingsIcon className="w-6 h-6 hover:animate-spin-slow" />
        </button>
      </div>
      <div className="flex flex-col items-center gap-5">
        <PDFUploader className='max-w-xl' />
        <DocumentList />
      </div>
      <SettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </div>
  );
}
