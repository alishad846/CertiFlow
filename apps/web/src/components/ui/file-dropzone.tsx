'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/cn';

export function FileDropzone({
  label,
  accept,
  onFileChange,
  onFilesChange,
  multiple = false,
  description
}: {
  label: string;
  accept: string;
  description: string;
  onFileChange?: (file: File | null) => void;
  onFilesChange?: (files: File[]) => void;
  multiple?: boolean;
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

  return (
    <div
      className={cn(
        'group rounded-[28px] border-2 border-dashed p-6 transition-all duration-200',
        isDragging ? 'border-accent-400 bg-accent-50 shadow-[0_16px_50px_rgba(42,141,240,0.14)]' : 'border-slate-200 bg-white hover:border-accent-200 hover:bg-slate-50'
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-4 text-center"
      >
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(42,141,240,0.12),rgba(42,141,240,0.04))] text-accent-700 shadow-inner">
          <UploadCloud className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <p className={cn('text-sm font-medium', fileName ? 'text-ink' : 'text-accent-700')}>
          {fileName || 'Drag and drop or browse files'}
        </p>
      </button>
    </div>
  );
}
