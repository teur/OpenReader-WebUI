import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentList } from '@/components/DocumentList';
import { SettingsModal } from '@/components/SettingsModal';

export default function Home() {
  return (
    <div className='p-3.5 sm:p-5'>
      <SettingsModal />
      <h1 className="text-xl font-bold text-center flex-grow">OpenReader WebUI</h1>
      <p className="text-sm mt-1 text-center text-muted mb-5">A bring your own text-to-speech api web interface for reading documents with high quality voices</p>
      <div className="flex flex-col items-center gap-5">
        <DocumentUploader className='max-w-xl' />
        <DocumentList />
      </div>
    </div>
  );
}
