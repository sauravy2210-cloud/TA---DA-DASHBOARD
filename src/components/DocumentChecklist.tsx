import { type FC, type DragEvent, useCallback, useRef, useState } from 'react';
import type { ClaimAttachment } from '../types';

interface DocumentChecklistProps {
  requiredDocs: string[];
  uploadedAttachments: ClaimAttachment[];
  onUpload?: (file: File, category: string) => void;
  onView?: (attachment: ClaimAttachment) => void;
  isEditable?: boolean;
}

const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

function findAttachment(
  doc: string,
  attachments: ClaimAttachment[]
): ClaimAttachment | undefined {
  const lower = doc.toLowerCase();
  return attachments.find(
    (a) =>
      a.category.toLowerCase() === lower ||
      a.fileName.toLowerCase().includes(lower.split(' ')[0])
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DocumentChecklist: FC<DocumentChecklistProps> = ({
  requiredDocs,
  uploadedAttachments,
  onUpload,
  onView,
  isEditable = false,
}) => {
  const [dragOverDoc, setDragOverDoc] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Invalid file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File too large. Max size: ${MAX_FILE_SIZE_MB}MB`;
    }
    return null;
  };

  const handleFileChange = useCallback(
    (doc: string, files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const err = validateFile(file);
      if (err) {
        setFileErrors((prev) => ({ ...prev, [doc]: err }));
        return;
      }
      setFileErrors((prev) => {
        const next = { ...prev };
        delete next[doc];
        return next;
      });
      onUpload?.(file, doc);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (doc: string, e: DragEvent) => {
      e.preventDefault();
      setDragOverDoc(null);
      handleFileChange(doc, e.dataTransfer.files);
    },
    [handleFileChange]
  );

  const missingDocs = requiredDocs.filter((doc) => !findAttachment(doc, uploadedAttachments));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Document Checklist
        </h3>
        <span className="text-xs text-gray-500">
          {requiredDocs.length - missingDocs.length} / {requiredDocs.length} uploaded
        </span>
      </div>

      {missingDocs.length > 0 && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          {missingDocs.length} required document{missingDocs.length > 1 ? 's' : ''} missing:{' '}
          <span className="font-medium">{missingDocs.join(', ')}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Document
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                File
              </th>
              {isEditable && (
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              )}
              {!isEditable && onView && (
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Preview
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {requiredDocs.map((doc) => {
              const attachment = findAttachment(doc, uploadedAttachments);
              const uploaded = !!attachment;
              const isDragOver = dragOverDoc === doc;
              const fileError = fileErrors[doc];

              return (
                <tr
                  key={doc}
                  className={isDragOver ? 'bg-blue-50' : 'hover:bg-gray-50 transition-colors'}
                  onDragOver={
                    isEditable
                      ? (e) => {
                          e.preventDefault();
                          setDragOverDoc(doc);
                        }
                      : undefined
                  }
                  onDragLeave={isEditable ? () => setDragOverDoc(null) : undefined}
                  onDrop={isEditable ? (e) => handleDrop(doc, e) : undefined}
                >
                  {/* Document name */}
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {doc}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    {uploaded ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        Uploaded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                        </svg>
                        Missing
                      </span>
                    )}
                  </td>

                  {/* Filename + size */}
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    {attachment ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-xs font-medium text-gray-700">
                          {attachment.fileName}
                        </span>
                        <span className="text-xs text-gray-400">{formatBytes(attachment.fileSize)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        {isEditable ? 'Drop file here or use Upload' : '—'}
                      </span>
                    )}
                    {fileError && (
                      <p className="text-xs text-red-500 mt-0.5">{fileError}</p>
                    )}
                  </td>

                  {/* Actions */}
                  {isEditable && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {attachment && onView && (
                          <button
                            type="button"
                            onClick={() => onView(attachment)}
                            className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            Preview
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[doc]?.click()}
                          className="rounded px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          {uploaded ? 'Replace' : 'Upload'}
                        </button>
                        <input
                          ref={(el) => { fileInputRefs.current[doc] = el; }}
                          type="file"
                          accept={ACCEPTED_EXTENSIONS.join(',')}
                          className="hidden"
                          onChange={(e) => handleFileChange(doc, e.target.files)}
                        />
                      </div>
                    </td>
                  )}

                  {!isEditable && onView && (
                    <td className="px-4 py-3 text-right">
                      {attachment ? (
                        <button
                          type="button"
                          onClick={() => onView(attachment)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          Preview
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEditable && (
        <p className="text-xs text-gray-400">
          Accepted formats: PDF, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB per file. You can also drag and drop files onto a row.
        </p>
      )}
    </div>
  );
};

export default DocumentChecklist;

