import { useEffect, useState } from 'react';

export function PDFSkeleton() {
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNotification(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center w-full">
      {showNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded shadow-lg z-50">
          There might be an issue with the file import. Please try again.
        </div>
      )}
      <div className="flex flex-col items-center w-full animate-pulse">
        {/* Show 3 skeleton pages by default */}
        {[1, 2, 3].map((index) => (
          <div key={`skeleton_${index}`}>
            {/* Page content skeleton */}
            <div className="flex justify-center my-4">
              <div className="bg-gray-200 shadow-lg">
                {/* Approximate dimensions of a PDF page */}
                <div className="w-[595px] h-[842px]"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}