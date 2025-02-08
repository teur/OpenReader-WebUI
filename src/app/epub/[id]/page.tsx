'use client';

import { useParams } from "next/navigation";
import Link from 'next/link';

export default function EPUBPage() {
  const { id } = useParams();

  return (
    <>
      <div className="p-2 pb-2 border-b border-offbase">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              onClick={() => { }}
              className="inline-flex items-center px-3 py-1 bg-base text-foreground rounded-lg hover:bg-offbase transform transition-transform duration-200 ease-in-out hover:scale-[1.02]"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Documents
            </Link>
          </div>
          <h1 className="ml-2 mr-2 text-md font-semibold text-foreground truncate">
            {id}
          </h1>
        </div>
      </div>

    </>
  );
}
