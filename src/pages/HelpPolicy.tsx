import { BookOpen } from 'lucide-react';

export default function HelpPolicy() {
  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <BookOpen size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Help & Policy Guidelines</h1>
          <p className="text-sm text-gray-500">Koenig Solutions — Travel Policy</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <iframe
          src="/policy-document.html"
          title="Koenig Travel Policy"
          className="w-full"
          style={{ height: 'calc(100vh - 220px)', minHeight: 600, border: 'none' }}
        />
      </div>
    </div>
  );
}
