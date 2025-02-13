'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild, Listbox, ListboxButton, ListboxOptions, ListboxOption, Button } from '@headlessui/react';
import { useTheme } from '@/contexts/ThemeContext';
import { useConfig } from '@/contexts/ConfigContext';
import { ChevronUpDownIcon, CheckIcon } from './icons/Icons';
import { indexedDBService } from '@/utils/indexedDB';
import { useDocuments } from '@/contexts/DocumentContext';
import { setItem, getItem } from '@/utils/indexedDB';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { THEMES } from '@/contexts/ThemeContext';

const isDev = process.env.NEXT_PUBLIC_NODE_ENV !== 'production' || process.env.NODE_ENV == null;

interface SettingsModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const themes = THEMES.map(id => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1)
}));

export function SettingsModal({ isOpen, setIsOpen }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { apiKey, baseUrl, updateConfig } = useConfig();
  const { refreshPDFs, refreshEPUBs, clearPDFs, clearEPUBs } = useDocuments();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const selectedTheme = themes.find(t => t.id === theme) || themes[0];
  const [showClearLocalConfirm, setShowClearLocalConfirm] = useState(false);
  const [showClearServerConfirm, setShowClearServerConfirm] = useState(false);

  // set firstVisit on initial load
  const checkFirstVist = useCallback(async () => {
    if (!isDev) return;
    const firstVisit = await getItem('firstVisit');
    if (firstVisit == null) {
      await setItem('firstVisit', 'true');
      setIsOpen(true);
    }
  }, [setIsOpen]);

  useEffect(() => {
    checkFirstVist();
    setLocalApiKey(apiKey);
    setLocalBaseUrl(baseUrl);
  }, [apiKey, baseUrl, checkFirstVist]);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await indexedDBService.syncToServer();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoad = async () => {
    try {
      setIsLoading(true);
      await indexedDBService.loadFromServer();
      await Promise.all([refreshPDFs(), refreshEPUBs()]);
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLocal = async () => {
    await clearPDFs();
    await clearEPUBs();
    setShowClearLocalConfirm(false);
  };

  const handleClearServer = async () => {
    try {
      const response = await fetch('/api/documents', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete server documents');
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
    setShowClearServerConfirm(false);
  };

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform rounded-2xl bg-base p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-semibold leading-6 text-foreground"
                  >
                    Settings
                  </DialogTitle>
                  <div className="mt-4">
                    <div className="relative space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">Theme</label>
                        <Listbox value={selectedTheme} onChange={(newTheme) => setTheme(newTheme.id)}>
                          <ListboxButton className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent transform transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:text-accent">
                            <span className="block truncate">{selectedTheme.name}</span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon className="h-5 w-5 text-muted" />
                            </span>
                          </ListboxButton>
                          <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <ListboxOptions className="absolute mt-1 max-h-40 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
                              {themes.map((theme) => (
                                <ListboxOption
                                  key={theme.id}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-accent/10 text-accent' : 'text-foreground'
                                    }`
                                  }
                                  value={theme}
                                >
                                  {({ selected }) => (
                                    <>
                                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                        {theme.name}
                                      </span>
                                      {selected ? (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-accent">
                                          <CheckIcon className="h-5 w-5" />
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </ListboxOption>
                              ))}
                            </ListboxOptions>
                          </Transition>
                        </Listbox>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">OpenAI API Key</label>
                        <input
                          type="password"
                          value={localApiKey}
                          onChange={(e) => setLocalApiKey(e.target.value)}
                          className="w-full rounded-lg bg-background py-2 px-3 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">OpenAI API Base URL</label>
                        <input
                          type="text"
                          value={localBaseUrl}
                          onChange={(e) => setLocalBaseUrl(e.target.value)}
                          className="w-full rounded-lg bg-background py-2 px-3 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>

                      {isDev && <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">Document Sync</label>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleLoad}
                            disabled={isSyncing || isLoading}
                            className="justify-center rounded-lg bg-background px-3 py-1.5 text-sm 
                                         font-medium text-foreground hover:bg-background/90 focus:outline-none 
                                         focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                                         transform transition-transform duration-200 ease-in-out hover:scale-[1.04] hover:text-accent
                                         disabled:opacity-50"
                          >
                            {isLoading ? 'Loading...' : 'Load docs from Server'}
                          </Button>
                          <Button
                            onClick={handleSync}
                            disabled={isSyncing || isLoading}
                            className="justify-center rounded-lg bg-background px-3 py-1.5 text-sm 
                                         font-medium text-foreground hover:bg-background/90 focus:outline-none 
                                         focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                                         transform transition-transform duration-200 ease-in-out hover:scale-[1.04] hover:text-accent
                                         disabled:opacity-50"
                          >
                            {isSyncing ? 'Saving...' : 'Save local to Server'}
                          </Button>
                        </div>
                      </div>}

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">Bulk Delete</label>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setShowClearLocalConfirm(true)}
                            className="justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm 
                                     font-medium text-white hover:bg-red-700 focus:outline-none 
                                     focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2
                                     transform transition-transform duration-200 ease-in-out hover:scale-[1.04]"
                          >
                            Delete local docs
                          </Button>
                          {isDev && <Button
                            onClick={() => setShowClearServerConfirm(true)}
                            className="justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm 
                                     font-medium text-white hover:bg-red-700 focus:outline-none 
                                     focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2
                                     transform transition-transform duration-200 ease-in-out hover:scale-[1.04]"
                          >
                            Delete server docs
                          </Button>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <Button
                      type="button"
                      className="inline-flex justify-center rounded-lg bg-accent px-3 py-1.5 text-sm 
                               font-medium text-white hover:bg-accent/90 focus:outline-none 
                               focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                               transform transition-transform duration-200 ease-in-out hover:scale-[1.04] hover:text-background"
                      onClick={async () => {
                        await updateConfig({
                          apiKey: localApiKey,
                          baseUrl: localBaseUrl
                        });
                        setIsOpen(false);
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      className="inline-flex justify-center rounded-lg bg-background px-3 py-1.5 text-sm 
                               font-medium text-foreground hover:bg-background/90 focus:outline-none 
                               focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                               transform transition-transform duration-200 ease-in-out hover:scale-[1.04] hover:text-accent"
                      onClick={() => {
                        setLocalApiKey(apiKey);
                        setLocalBaseUrl(baseUrl);
                        setIsOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ConfirmDialog
        isOpen={showClearLocalConfirm}
        onClose={() => setShowClearLocalConfirm(false)}
        onConfirm={handleClearLocal}
        title="Delete Local Documents"
        message="Are you sure you want to delete all local documents? This action cannot be undone."
        confirmText="Delete"
        isDangerous={true}
      />

      <ConfirmDialog
        isOpen={showClearServerConfirm}
        onClose={() => setShowClearServerConfirm(false)}
        onConfirm={handleClearServer}
        title="Delete Server Documents"
        message="Are you sure you want to delete all documents from the server? This action cannot be undone."
        confirmText="Delete"
        isDangerous={true}
      />
    </>
  );
}
