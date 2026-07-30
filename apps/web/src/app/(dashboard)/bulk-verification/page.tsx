'use client';

import { ChangeEvent, DragEvent, useState } from 'react';

export default function BulkVerificationPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [certificateLinks, setCertificateLinks] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

const [results, setResults] = useState<
  {
    student: string;
    certificateId: string;
    status: "Verified" | "Fake";
    reason: string;
  }[]
>([]);

  const supportedTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 KB';

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function addFiles(selectedFiles: File[]) {
  const validFiles = selectedFiles.filter((file) =>
    supportedTypes.includes(file.type),
  );

  setFiles((currentFiles) => {
    const existingKeys = new Set(
      currentFiles.map(
        (file) => `${file.name}-${file.size}-${file.lastModified}`,
      ),
    );

    const newFiles = validFiles.filter(
      (file) =>
        !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`),
    );

    return [...currentFiles, ...newFiles];
  });
}

function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
  addFiles(Array.from(event.target.files ?? []));
  event.target.value = '';
}

function handleDrop(event: DragEvent<HTMLLabelElement>) {
  event.preventDefault();
  addFiles(Array.from(event.dataTransfer.files));
}

function removeFile(indexToRemove: number) {
  setFiles((currentFiles) =>
    currentFiles.filter((_, index) => index !== indexToRemove),
  );
}

  async function verifyCertificates() {
  setIsVerifying(true);

  await new Promise((resolve) => setTimeout(resolve, 2500));

  setResults([
    {
      student: "Rahul Sharma",
      certificateId: "CERT-1001",
      status: "Verified",
      reason: "Certificate matched database",
    },
    {
      student: "Priya Singh",
      certificateId: "CERT-1002",
      status: "Fake",
      reason: "Certificate ID not found",
    },
  ]);

  setIsVerifying(false);
}

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">
          Bulk Certificate Verification
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Upload multiple certificates or paste certificate links to verify
          their authenticity and detect suspicious records.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Upload certificates</h2>

        <p className="mt-1 text-sm text-gray-500">
          Supported formats: PDF, PNG, JPG and JPEG.
        </p>

        <label
  onDragOver={(event) => event.preventDefault()}
  onDrop={handleDrop}
  className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 py-12 text-center transition hover:border-gray-500 hover:bg-gray-50"
>
  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
    ↑
  </div>

  <span className="mt-4 text-base font-medium">
    Drag and drop certificate files here
  </span>

  <span className="mt-1 text-sm text-gray-500">
    or click to browse from your computer
  </span>

  <span className="mt-3 text-xs text-gray-400">
    PDF, PNG, JPG and JPEG
  </span>

  <input
    type="file"
    accept=".pdf,.png,.jpg,.jpeg"
    multiple
    onChange={handleFileChange}
    className="hidden"
  />
</label>

        {files.length > 0 && (
  <div className="mt-5 rounded-xl border bg-gray-50 p-4">
    <div className="flex items-center justify-between">
      <p className="font-medium">
        {files.length} file{files.length !== 1 ? 's' : ''} selected
      </p>

      <button
        type="button"
        onClick={() => setFiles([])}
        className="text-sm font-medium text-red-600 hover:underline"
      >
        Clear all
      </button>
    </div>

    <ul className="mt-4 space-y-3">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${file.size}-${file.lastModified}`}
          className="flex items-center justify-between rounded-lg border bg-white px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              {formatFileSize(file.size)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => removeFile(index)}
            className="ml-4 rounded-lg px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  </div>
)}
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Certificate links</h2>

        <p className="mt-1 text-sm text-gray-500">
          Paste one certificate link per line.
        </p>

        <textarea
          value={certificateLinks}
          onChange={(event) => setCertificateLinks(event.target.value)}
          placeholder={`https://example.com/certificate/1\nhttps://example.com/certificate/2`}
          rows={6}
          className="mt-5 w-full rounded-xl border border-gray-300 p-4 text-sm outline-none focus:border-gray-500"
        />
      </section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
  <h2 className="text-xl font-semibold">Verification Summary</h2>

  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
    <div className="rounded-xl border p-4">
      <p className="text-sm text-gray-500">Total Certificates</p>
      <p className="mt-2 text-3xl font-bold">0</p>
    </div>

    <div className="rounded-xl border p-4">
      <p className="text-sm text-gray-500">Verified</p>
      <p className="mt-2 text-3xl font-bold text-green-600">0</p>
    </div>

    <div className="rounded-xl border p-4">
      <p className="text-sm text-gray-500">Fake</p>
      <p className="mt-2 text-3xl font-bold text-red-600">0</p>
    </div>

    <div className="rounded-xl border p-4">
      <p className="text-sm text-gray-500">Pending</p>
      <p className="mt-2 text-3xl font-bold text-yellow-600">0</p>
    </div>
  </div>
</section>
<section className="rounded-2xl border bg-white p-6 shadow-sm">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-semibold">Verification Results</h2>

    <button
      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-100"
    >
      Download CSV
    </button>
  </div>

  <div className="mt-6 overflow-x-auto">
    <table className="min-w-full border-collapse">
      <thead>
        <tr className="border-b">
          <th className="px-4 py-3 text-left">Student</th>
          <th className="px-4 py-3 text-left">Certificate ID</th>
          <th className="px-4 py-3 text-left">Status</th>
          <th className="px-4 py-3 text-left">Reason</th>
        </tr>
      </thead>

      <tbody>
  {results.length === 0 ? (
    <tr>
      <td className="px-4 py-4 text-gray-500" colSpan={4}>
        No certificates verified yet.
      </td>
    </tr>
  ) : (
    results.map((result, index) => (
      <tr key={index} className="border-b">
        <td className="px-4 py-3">{result.student}</td>

        <td className="px-4 py-3">
          {result.certificateId}
        </td>

        <td className="px-4 py-3">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              result.status === "Verified"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {result.status}
          </span>
        </td>

        <td className="px-4 py-3">
          {result.reason}
        </td>
      </tr>
    ))
  )}
</tbody>
    </table>
  </div>
</section>

      <div className="flex justify-end">
        <button
  type="button"
  onClick={verifyCertificates}
  disabled={
    (files.length === 0 &&
      certificateLinks.trim() === "") ||
    isVerifying
  }
  className="rounded-xl bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
>
  {isVerifying ? "Verifying..." : "Verify Certificates"}
</button>
      </div>
    </main>
  );
}