'use client';

import { Fragment } from 'react';
import { Dialog, Transition, Listbox } from '@headlessui/react';
import { useTheme } from '@/context/ThemeContext';

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
  const selectedTheme = themes.find(t => t.id === theme) || themes[0];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform rounded-2xl bg-base p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-foreground"
                >
                  Settings
                </Dialog.Title>
                <div className="mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Theme</label>
                      <Listbox value={selectedTheme} onChange={(newTheme) => setTheme(newTheme.id)}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent">
                            <span className="block truncate">{selectedTheme.name}</span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className="h-5 w-5 text-muted" 
                                viewBox="0 0 20 20" 
                                fill="currentColor"
                              >
                                <path 
                                  fillRule="evenodd" 
                                  d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" 
                                  clipRule="evenodd" 
                                />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
                              {themes.map((theme) => (
                                <Listbox.Option
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
                                          <svg 
                                            xmlns="http://www.w3.org/2000/svg" 
                                            className="h-5 w-5" 
                                            viewBox="0 0 20 20" 
                                            fill="currentColor"
                                          >
                                            <path 
                                              fillRule="evenodd" 
                                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                                              clipRule="evenodd" 
                                            />
                                          </svg>
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-lg bg-accent px-4 py-2 text-sm 
                             font-medium text-white hover:bg-accent/90 focus:outline-none 
                             focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                             transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
