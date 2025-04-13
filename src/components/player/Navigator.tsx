'use client';

import { Button } from '@headlessui/react';
import { useState } from 'react'; // Import useState

export const Navigator = ({ currentPage, numPages, skipToLocation }: {
  currentPage: number;
  numPages: number | undefined;
  skipToLocation: (location: string | number, shouldPause?: boolean) => void;
}) => {
  // State to hold the value of the input field
  const [targetPage, setTargetPage] = useState<string>('');

  const effectiveNumPages = numPages || 1;

  const handleGoToPage = () => {
    const pageNum = parseInt(targetPage, 10);
    // Validate if it's a number and within the valid range
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= effectiveNumPages) {
      skipToLocation(pageNum, true);
    } else {
      // Handle invalid input, e.g., show an error, shake the input, or just ignore
      console.warn(`Invalid page number entered: ${targetPage}`);
    }
  };

  // Determine if the Go button should be disabled
  const isGoDisabled = () => {
    if (!targetPage) return true; // Disabled if empty
    const pageNum = parseInt(targetPage, 10);
    return isNaN(pageNum) || pageNum < 1 || pageNum > effectiveNumPages;
  };

  // Handle Enter key press in the input field
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isGoDisabled()) {
      handleGoToPage();
    }
  };

  return (
    <div className="flex items-center space-x-1">
      {/* Page back */}
      <Button
        onClick={() => skipToLocation(currentPage - 1, true)}
        disabled={currentPage <= 1}
        className="relative p-2 rounded-full text-foreground hover:bg-offbase data-[hover]:bg-offbase data-[active]:bg-offbase/80 transition-colors duration-200 focus:outline-none disabled:opacity-50"
        aria-label="Previous page"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </Button>

      {/* Page number display */}
      <div className="bg-offbase px-2 py-0.5 rounded-full">
        <p className="text-xs whitespace-nowrap">
          {currentPage} / {effectiveNumPages}
        </p>
      </div>


      {/* Page forward */}
      <Button
        onClick={() => skipToLocation(currentPage + 1, true)}
        disabled={currentPage >= effectiveNumPages}
        className="relative p-2 rounded-full text-foreground hover:bg-offbase data-[hover]:bg-offbase data-[active]:bg-offbase/80 transition-colors duration-200 focus:outline-none disabled:opacity-50"
        aria-label="Next page"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          {/* Corrected path for forward arrow */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </Button>

      {/* Go to Page Input */}
      <input
        type="number"
        min="1"
        max={effectiveNumPages}
        value={targetPage}
        onChange={(e) => setTargetPage(e.target.value)}
        onKeyDown={handleKeyDown} // Handle Enter key
        // Changed bg-offbase to bg-white and added text-black for contrast
        className="w-12 px-2 py-0.5 text-xs text-center bg-white text-black rounded-full focus:outline-none focus:ring-1 focus:ring-primary appearance-none [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none" // Basic styling, hide number spinners
        placeholder="Page" // Changed placeholder from "1" to "Page" for clarity
        aria-label="Go to page number"
      />

      {/* Go to Page Button */}
      <Button
        onClick={handleGoToPage}
        disabled={isGoDisabled()}
        className="relative px-2 py-1 rounded-full text-xs text-foreground bg-offbase hover:bg-offbase/90 data-[hover]:bg-offbase/90 data-[active]:bg-offbase/80 transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Go to entered page"
      >
        Go to Page
      </Button>

    </div>
  );
}
