'use client';

import { useState } from 'react';
import { PDFUploader } from '@/components/PDFUploader';
import { DocumentList } from '@/components/DocumentList';
import { SettingsModal } from '@/components/SettingsModal';
import { SettingsIcon } from '@/components/icons/Icons';
import { Button } from '@headlessui/react';

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className='p-3 md:p-5'>
      <Button
        onClick={() => setIsSettingsOpen(true)}
        className="rounded-full p-2 text-foreground hover:bg-offbase transform transition-transform duration-200 ease-in-out hover:scale-[1.1] hover:text-accent absolute top-3 right-3"
        aria-label="Settings"
        tabIndex={0}
      >
        <SettingsIcon className="w-6 h-6 hover:animate-spin-slow" />
      </Button>
      <h1 className="text-xl font-bold text-center flex-grow">OpenReader WebUI</h1>
      <p className="text-sm text-center text-muted mb-5">{'A "bring your own text-to-speech api" web interface for reading documents with high quality voices.'}</p>
      <div className="flex flex-col items-center gap-5">
        <PDFUploader className='max-w-xl' />
        <DocumentList />
      </div>
      <SettingsModal isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </div>
  );
}
