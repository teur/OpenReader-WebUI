'use client';

import { Input, Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ChevronUpDownIcon } from '@/components/icons/Icons';
import { useConfig } from '@/contexts/ConfigContext';
import { useCallback, useEffect, useState } from 'react';

export const SpeedControl = ({ setSpeedAndRestart }: {
  setSpeedAndRestart: (speed: number) => void;
}) => {
  const { voiceSpeed } = useConfig();
  const [localSpeed, setLocalSpeed] = useState(voiceSpeed);

  // Sync local speed with global state
  useEffect(() => {
    setLocalSpeed(voiceSpeed);
  }, [voiceSpeed]);

  // Handler for slider change (updates local state only)
  const handleSpeedChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSpeed(parseFloat(event.target.value));
  }, []);

  // Handler for slider release
  const handleSpeedChangeComplete = useCallback(() => {
    if (localSpeed !== voiceSpeed) {
      setSpeedAndRestart(localSpeed);
    }
  }, [localSpeed, voiceSpeed, setSpeedAndRestart]);

  return (
    <Popover className="relative">
      <PopoverButton className="flex items-center space-x-0.5 sm:space-x-1 bg-transparent text-foreground text-xs sm:text-sm focus:outline-none cursor-pointer hover:bg-offbase rounded pl-1.5 sm:pl-2 pr-0.5 sm:pr-1 py-0.5 sm:py-1">
        <span>{Number.isInteger(localSpeed) ? localSpeed.toString() : localSpeed.toFixed(1)}x</span>
        <ChevronUpDownIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      </PopoverButton>
      <PopoverPanel anchor="top" className="absolute z-50 bg-base p-3 rounded-md shadow-lg border border-offbase">
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between">
            <span className="text-xs">0.5x</span>
            <span className="text-xs font-bold">{Number.isInteger(localSpeed) ? localSpeed.toString() : localSpeed.toFixed(1)}x</span>
            <span className="text-xs">3x</span>
          </div>
          <Input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={localSpeed}
            onChange={handleSpeedChange}
            onMouseUp={handleSpeedChangeComplete}
            onKeyUp={handleSpeedChangeComplete}
            onTouchEnd={handleSpeedChangeComplete}
            className="w-full bg-offbase rounded-lg appearance-none cursor-pointer accent-accent [&::-webkit-slider-runnable-track]:bg-offbase [&::-webkit-slider-runnable-track]:rounded-lg [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-moz-range-track]:bg-offbase [&::-moz-range-track]:rounded-lg [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent"
          />
        </div>
      </PopoverPanel>
    </Popover>
  );
}