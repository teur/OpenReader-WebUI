'use client';

import React, { useState } from 'react';
import { useTTS } from '@/contexts/TTSContext';
import { Button, Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react';
import {
  PlayIcon,
  PauseIcon,
  SkipForwardIcon,
  SkipBackwardIcon,
  ChevronUpDownIcon,
} from './icons/Icons';

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-spin h-4 w-4 border-2 border-foreground border-t-transparent rounded-full" />
    </div>
  );
}

const speedOptions = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 1.75, label: '1.75x' },
  { value: 2, label: '2x' },
  { value: 2.5, label: '2.5x' },
  { value: 3, label: '3x' },
];

export default function TTSPlayer() {
  const [isVisible, setIsVisible] = useState(true);
  const { 
    isPlaying, 
    togglePlay, 
    skipForward, 
    skipBackward, 
    isProcessing, 
    speed, 
    setSpeedAndRestart,
    voice,
    setVoiceAndRestart,
    availableVoices,
  } = useTTS();

  //console.log(availableVoices);

  return (
    <div 
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } transition-opacity duration-300`}
    >
      <div className="bg-base dark:bg-base rounded-full shadow-lg px-4 py-1 flex items-center space-x-1 relative">
        <Button
          onClick={skipBackward}
          className="relative p-2 rounded-full text-foreground hover:bg-offbase data-[hover]:bg-offbase data-[active]:bg-offbase/80 transition-colors duration-200 focus:outline-none disabled:opacity-50"
          aria-label="Skip backward"
          disabled={isProcessing}
        >
          {isProcessing ? <LoadingSpinner /> : <SkipBackwardIcon />}
        </Button>
        
        <Button
          onClick={togglePlay}
          className="relative p-2 rounded-full text-foreground hover:bg-offbase data-[hover]:bg-offbase data-[active]:bg-offbase/80 transition-colors duration-200 focus:outline-none"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </Button>

        <Button
          onClick={skipForward}
          className="relative p-2 rounded-full text-foreground hover:bg-offbase data-[hover]:bg-offbase data-[active]:bg-offbase/80 transition-colors duration-200 focus:outline-none disabled:opacity-50"
          aria-label="Skip forward"
          disabled={isProcessing}
        >
          {isProcessing ? <LoadingSpinner /> : <SkipForwardIcon />}
        </Button>

        <div className="relative">
          <Listbox value={speed} onChange={setSpeedAndRestart}>
            <ListboxButton className="flex items-center space-x-1 bg-transparent text-foreground text-sm focus:outline-none cursor-pointer hover:bg-offbase rounded pl-2 pr-1 py-1">
              <span>{speed}x</span>
              <ChevronUpDownIcon className="h-3 w-3" />
            </ListboxButton>
            <ListboxOptions className="absolute bottom-full mb-1 w-24 overflow-auto rounded-lg bg-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {speedOptions.map((option) => (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className={({ active, selected }) =>
                    `relative cursor-pointer select-none py-2 px-3 ${
                      active ? 'bg-offbase' : ''
                    } ${selected ? 'font-medium' : ''}`
                  }
                >
                  {option.label}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Listbox>
        </div>

        <div className="relative">
          <Listbox value={voice} onChange={setVoiceAndRestart}>
            <ListboxButton className="flex items-center space-x-1 bg-transparent text-foreground text-sm focus:outline-none cursor-pointer hover:bg-offbase rounded pl-2 pr-1 py-1">
              <span>{voice}</span>
              <ChevronUpDownIcon className="h-3 w-3" />
            </ListboxButton>
            <ListboxOptions className="absolute bottom-full mb-1 w-32 overflow-auto rounded-lg bg-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {availableVoices.map((voiceId) => (
                <ListboxOption
                  key={voiceId}
                  value={voiceId}
                  className={({ active, selected }) =>
                    `relative cursor-pointer select-none py-2 px-3 ${
                      active ? 'bg-offbase' : ''
                    } ${selected ? 'font-medium' : ''}`
                  }
                >
                  <span>{voiceId}</span>
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Listbox>
        </div>
      </div>
    </div>
  );
}
