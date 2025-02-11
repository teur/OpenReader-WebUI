'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild, Listbox, ListboxButton, ListboxOptions, ListboxOption, Button } from '@headlessui/react';
import { useTheme } from '@/contexts/ThemeContext';
import { useConfig } from '@/contexts/ConfigContext';
import { ChevronUpDownIcon, CheckIcon } from './icons/Icons';
import { indexedDBService } from '@/utils/indexedDB';
import { useDocuments } from '@/contexts/DocumentContext';

const isDev = process.env.NEXT_PUBLIC_NODE_ENV !== 'production' || process.env.NODE_ENV == null;

interface SettingsModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const themes = [
  { id: 'light' as const, name: 'Light' },
  { id: 'dark' as const, name: 'Dark' },
  { id: 'system' as const, name: 'System' },
];

export function SettingsModal({ isOpen, setIsOpen }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { apiKey, baseUrl, updateConfig } = useConfig();
  const { refreshPDFs, refreshEPUBs } = useDocuments();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const selectedTheme = themes.find(t => t.id === theme) || themes[0];

  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalBaseUrl(baseUrl);
  }, [apiKey, baseUrl]);

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

  return (
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
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Theme</label>
                      <Listbox value={selectedTheme} onChange={(newTheme) => setTheme(newTheme.id)}>
                        <div className="relative">
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
                            <ListboxOptions className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
                              {themes.map((theme) => (
                                <ListboxOption
                                  key={theme.id}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                      active ? 'bg-accent/10 text-accent' : 'text-foreground'
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
                        </div>
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
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={handleSync}
                              disabled={isSyncing || isLoading}
                              className="inline-flex justify-center rounded-lg bg-background px-4 py-2 text-sm 
                                       font-medium text-foreground hover:bg-background/90 focus:outline-none 
                                       focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                                       transform transition-transform duration-200 ease-in-out hover:scale-[1.04] hover:text-accent
                                       disabled:opacity-50"
                            >
                              {isSyncing ? 'Saving...' : 'Save to Server'}
                            </button>
                            <button
                              onClick={handleLoad}
                              disabled={isSyncing || isLoading}
                              className="inline-flex justify-center rounded-lg bg-background px-4 py-2 text-sm 
                                       font-medium text-foreground hover:bg-background/90 focus:outline-none 
                                       focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                                       transform transition-transform duration-200 ease-in-out hover:scale-[1.04] hover:text-accent
                                       disabled:opacity-50"
                            >
                              {isLoading ? 'Loading...' : 'Load from Server'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>}
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <Button
                    type="button"
                    className="inline-flex justify-center rounded-lg bg-accent px-4 py-2 text-sm 
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
                    className="inline-flex justify-center rounded-lg bg-background px-4 py-2 text-sm 
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
  );
}
