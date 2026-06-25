import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  FileText, FileImage, File, Paperclip, Upload,
  Eye, RefreshCw, CheckCircle, XCircle, Filter,
} from 'lucide-react';
import type { ClaimAttachment, AttachmentCategory, UserRole } from '../types';

interface AttachmentPreviewProps {
  attachments: ClaimAttachment[];
  onUpload?: (file: File, category: AttachmentCategory, lineItemId?: string) => void;
  isEditable?: boolean;
  userRole: UserRole;
}

const ALL_CATEGORIES: AttachmentCategory[] = [
  'Ticket', 'Boarding Pass', 'Hotel Invoice', 'Cab Receipt', 'Other',
];

// Which categories are "required" for a typical claim
const REQUIRED_CATEGORIES: AttachmentCategory[] = ['Ticket', 'Boarding Pass', 'Hotel Invoice'];

const CATEGORY_COLORS: Record<AttachmentCategory, string> = {
  'Ticket': 'bg-blue-100 text-blue-700',
  'Boarding Pass': 'bg-purple-100 text-purple-700',
  'Hotel Invoice': 'bg-green-100 text-green-700',
  'Cab Receipt': 'bg-amber-100 text-amber-700',
  'Other': 'bg-gray-100 text-gray-600',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function FileIcon({ fileType, className }: { fileType: string; className?: string }) {
  const cls = className ?? 'w-8 h-8';
  const lower = fileType.toLowerCase();
  if (lower.includes('image') || lower === 'jpg' || lower === 'jpeg' || lower === 'png' || lower === 'webp') {
    return <FileImage className={`${cls} text-emerald-500`} />;
  }
  if (lower === 'pdf' || lower.includes('pdf')) {
    return <FileText className={`${cls} text-red-500`} />;
  }
  return <File className={`${cls} text-gray-400`} />;
}

function AttachmentCard({
  attachment,
  isEditable,
  onReplace,
  onView,
}: {
  attachment: ClaimAttachment;
  isEditable?: boolean;
  onReplace?: (a: ClaimAttachment) => void;
  onView?: (a: ClaimAttachment) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Icon + filename */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg border border-gray-100">
          <FileIcon fileType={attachment.fileType} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate" title={attachment.fileName}>
            {attachment.fileName}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{attachment.fileType.toUpperCase()} · {formatFileSize(attachment.fileSize)}</p>
        </div>
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[attachment.category]}`}>
          {attachment.category}
        </span>
        {attachment.verified != null && (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${attachment.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {attachment.verified ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {attachment.verified ? 'Verified' : 'Unverified'}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="text-xs text-gray-400 space-y-0.5">
        <div>Uploaded {formatDate(attachment.uploadedAt)} by <span className="text-gray-600">{attachment.uploadedBy}</span></div>
        {attachment.verifiedBy && (
          <div>Verified by <span className="text-gray-600">{attachment.verifiedBy}</span>{attachment.verifiedAt ? ` on ${formatDate(attachment.verifiedAt)}` : ''}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onView?.(attachment)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg py-1.5 hover:bg-indigo-50 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
        {isEditable && (
          <button
            type="button"
            onClick={() => onReplace?.(attachment)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Replace
          </button>
        )}
      </div>
    </div>
  );
}

function MissingCard({
  category,
  isEditable,
  onUpload,
}: {
  category: AttachmentCategory;
  isEditable?: boolean;
  onUpload?: (category: AttachmentCategory) => void;
}) {
  return (
    <div className="border-2 border-dashed border-red-200 bg-red-50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center min-h-[160px]">
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
        <Paperclip className="w-5 h-5 text-red-400" />
      </div>
      <div>
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category]}`}>
          {category}
        </span>
      </div>
      <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Required</p>
      <p className="text-xs text-red-400">No document uploaded</p>
      {isEditable && (
        <button
          type="button"
          onClick={() => onUpload?.(category)}
          className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
      )}
    </div>
  );
}

// Simulated preview: opens a placeholder data URL in a new tab
function simulatePreview(attachment: ClaimAttachment) {
  const html = `
    <html>
    <head><title>${attachment.fileName}</title>
    <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f8fafc;color:#334155;gap:16px;}
    .badge{background:#e0e7ff;color:#4338ca;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;}
    .box{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.06);}
    </style></head>
    <body><div class="box">
    <svg width="48" height="48" fill="none" stroke="#6366f1" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    <h2 style="margin:12px 0 4px">${attachment.fileName}</h2>
    <span class="badge">${attachment.category}</span>
    <p style="color:#64748b;font-size:13px;margin-top:12px">Preview not available in simulation mode.<br/>In production, this would render the actual file.</p>
    <p style="color:#94a3b8;font-size:12px">Uploaded by ${attachment.uploadedBy} on ${formatDate(attachment.uploadedAt)}</p>
    </div></body></html>
  `;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments,
  onUpload,
  isEditable = false,
  userRole,
}) => {
  const [activeFilter, setActiveFilter] = useState<AttachmentCategory | 'All'>('All');
  const replaceRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [pendingReplace, setPendingReplace] = useState<ClaimAttachment | null>(null);
  const [pendingUploadCategory, setPendingUploadCategory] = useState<AttachmentCategory | null>(null);

  const canEdit = isEditable && (userRole === 'Trainer' || userRole === 'HRAdmin' || userRole === 'SuperAdmin');

  const filtered = useMemo(() => {
    if (activeFilter === 'All') return attachments;
    return attachments.filter((a) => a.category === activeFilter);
  }, [attachments, activeFilter]);

  // Find required categories not yet uploaded
  const uploadedCategories = useMemo(() => new Set(attachments.map((a) => a.category)), [attachments]);
  const missingRequired = useMemo(
    () => REQUIRED_CATEGORIES.filter((c) => !uploadedCategories.has(c)),
    [uploadedCategories],
  );

  const handleReplace = useCallback((a: ClaimAttachment) => {
    setPendingReplace(a);
    replaceRef.current?.click();
  }, []);

  const handleMissingUpload = useCallback((category: AttachmentCategory) => {
    setPendingUploadCategory(category);
    uploadRef.current?.click();
  }, []);

  const handleReplaceFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingReplace && onUpload) {
      onUpload(file, pendingReplace.category, pendingReplace.lineItemId);
    }
    setPendingReplace(null);
    e.target.value = '';
  }, [pendingReplace, onUpload]);

  const handleUploadFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUploadCategory && onUpload) {
      onUpload(file, pendingUploadCategory);
    }
    setPendingUploadCategory(null);
    e.target.value = '';
  }, [pendingUploadCategory, onUpload]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<AttachmentCategory | 'All', number>> = { All: attachments.length };
    ALL_CATEGORIES.forEach((c) => {
      counts[c] = attachments.filter((a) => a.category === c).length;
    });
    return counts;
  }, [attachments]);

  return (
    <div className="space-y-5">
      {/* Hidden file inputs */}
      <input ref={replaceRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleReplaceFileChange} />
      <input ref={uploadRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleUploadFileChange} />

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Paperclip className="w-4 h-4 text-indigo-500" />
          <span><strong className="text-gray-800">{attachments.length}</strong> attachment{attachments.length !== 1 ? 's' : ''}</span>
          {missingRequired.length > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              · <XCircle className="w-4 h-4" /> {missingRequired.length} required missing
            </span>
          )}
        </div>

        {/* Role badge */}
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
          Viewing as <strong>{userRole}</strong>
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {(['All', ...ALL_CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveFilter(cat)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
              activeFilter === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {cat} {categoryCounts[cat] != null && categoryCounts[cat]! > 0 && (
              <span className={`ml-1 ${activeFilter === cat ? 'text-indigo-200' : 'text-gray-400'}`}>({categoryCounts[cat]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Attachment grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <AttachmentCard
              key={a.attachmentId}
              attachment={a}
              isEditable={canEdit}
              onView={simulatePreview}
              onReplace={handleReplace}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Paperclip className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">No attachments in this category</p>
        </div>
      )}

      {/* Missing required placeholders — always shown regardless of filter */}
      {missingRequired.length > 0 && (activeFilter === 'All' || missingRequired.includes(activeFilter as AttachmentCategory)) && (
        <div>
          <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Required documents missing
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {missingRequired
              .filter((c) => activeFilter === 'All' || c === activeFilter)
              .map((cat) => (
                <MissingCard
                  key={cat}
                  category={cat}
                  isEditable={canEdit}
                  onUpload={handleMissingUpload}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentPreview;

