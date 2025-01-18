'use client';

import React, { useState } from 'react';
import { useTTS } from '@/context/TTSContext';
import { Button } from '@headlessui/react';
import {
  PlayIcon,
  PauseIcon,
  SkipForwardIcon,
  SkipBackwardIcon,
} from './icons/Icons';

export default function TTSPlayer() {
  const [isVisible, setIsVisible] = useState(true);
  const { isPlaying, togglePlay, skipForward, skipBackward } = useTTS();

  return (
    <div 
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } transition-opacity duration-300`}
    >
      <div className="bg-base dark:bg-base rounded-full shadow-lg px-2 py-1 flex items-center space-x-2 relative">
        <Button
          onClick={skipBackward}
          className="relative p-2 rounded-full text-foreground hover:bg-offbase data-[hover]:bg-offbase data-[active]:bg-offbase/80 transition-colors duration-200 focus:outline-none"
          aria-label="Skip backward"
        >
          <SkipBackwardIcon />
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
          className="relative p-2 rounded-full text-foreground hover:bg-offbase data-[hover]:bg-offbase data-[active]:bg-offbase/80 transition-colors duration-200 focus:outline-none"
          aria-label="Skip forward"
        >
          <SkipForwardIcon />
        </Button>
      </div>
    </div>
  );
}
