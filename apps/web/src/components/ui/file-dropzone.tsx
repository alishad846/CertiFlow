'use client';

import { useRef, useState } from 'react';
import { UploadCloud, X, FileText } from 'lucide-react';
import { cn } from '@/lib/cn';

export function FileDropzone({
  label,
  accept,
  onFileChange,
  onFilesChange,
  multiple = false,
  description,
  required = false
}: {
  label: string;
  accept: string;
  description: string;
  onFileChange?: (file: File | null) => void;
  onFilesChange?: (files: File[]) => void;
  multiple?: boolean;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');

  const handleFile = (file: File | null) => {
    setFileName(file?.name ?? '');
    onFileChange?.(file);
  };

  const handleFiles = (files: File[]) => {
    setFileName(files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : '');
    onFilesChange?.(files);
    onFileChange?.(files[0] ?? null);
  };

  const clear = () => {
    setFileName('');
    onFileChange?.(null);
    onFilesChange?.([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  // A single file is already chosen — show it with a remove button, and block re-upload until removed.
  const hasSingleFile = !multiple && !!fileName;

  return (
    <div
      className={cn(
        'group rounded-[28px] border-2 border-dashed p-6 transition-all duration-200',
        isDragging && !hasSingleFile
          ? 'border-bronze bg-bronze/5 shadow-[0_16px_50px_-24px_rgba(148,112,63,0.5)]'
          : hasSingleFile
            ? 'border-[color:var(--color-border)] bg-paper-dim/40'
            : 'border-[color:var(--color-border)] bg-paper-bright hover:border-bronze/50 hover:bg-paper-dim/30'
      )}
      onDragOver={(event) => {
        if (hasSingleFile) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        if (hasSingleFile) return; // must remove the current file first
        event.preventDefault();
        setIsDragging(false);
        const files = Array.from(event.dataTransfer.files ?? []);
        if (multiple) {
          handleFiles(files);
        } else {
          handleFile(files[0] ?? null);
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (multiple) {
            handleFiles(files);
          } else {
            handleFile(files[0] ?? null);
          }
          event.target.value = '';
        }}
      />

      {hasSingleFile ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-serif text-lg text-ink">
            {label}
            {required ? <span className="text-[#a3412e]"> *</span> : null}
          </p>
          <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-bronze/30 bg-bronze/5 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <FileText className="h-4 w-4 shrink-0 text-bronze-deep" />
              <span className="truncate">{fileName}</span>
            </span>
            <button
              type="button"
              onClick={clear}
              aria-label="Remove file"
              title="Remove file"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#a3412e] transition hover:bg-[#a3412e]/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-ink-faint">Remove this file to upload a different one.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-4 text-center"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-bronze/25 bg-bronze/10 text-bronze-deep">
            <UploadCloud className="h-6 w-6" />
          </span>
          <div>
            <p className="font-serif text-lg text-ink">
              {label}
              {required ? <span className="text-[#a3412e]"> *</span> : null}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">{description}</p>
          </div>
          <p className={cn('text-sm font-medium', fileName ? 'text-ink' : 'text-bronze-deep')}>
            {fileName || 'Drag and drop or browse files'}
          </p>
        </button>
      )}
    </div>
  );
}
