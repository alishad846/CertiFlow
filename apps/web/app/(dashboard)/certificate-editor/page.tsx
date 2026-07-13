'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  FileJson2,
  Moon,
  Play,
  RotateCcw,
  Save,
  Send,
  Sun,
  X
} from 'lucide-react';

type EditorLanguage = 'json' | 'javascript' | 'plaintext';

type EditorFile = {
  id: string;
  name: string;
  language: EditorLanguage;
  content: string;
};

type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const initialFiles: EditorFile[] = [
  {
    id: 'template',
    name: 'template.json',
    language: 'json',
    content: `{
  "name": "Main certificate template",
  "issueDateMode": "current_date",
  "issueDateValue": null,
  "width": 1200,
  "height": 800
}`
  },
  {
    id: 'fields',
    name: 'fields.json',
    language: 'json',
    content: `[
  {
    "field": "name",
    "x": 200,
    "y": 200,
    "width": 300,
    "fontSize": 36,
    "fontFamily": "Poppins",
    "color": "#0f172a",
    "align": "center"
  },
  {
    "field": "course",
    "x": 200,
    "y": 280,
    "width": 300,
    "fontSize": 22,
    "fontFamily": "Poppins",
    "color": "#475569",
    "align": "center"
  }
]`
  },
  {
    id: 'preview',
    name: 'preview.js',
    language: 'javascript',
    content: `// CertiFlow certificate preview

function generateCertificate(data) {
  console.log("Generating certificate...");
  console.log("Recipient:", data.name);
  console.log("Course:", data.course);

  return {
    success: true,
    message: "Certificate generated successfully"
  };
}

generateCertificate({
  name: "Sample Student",
  course: "Web Development"
});`
  }
];

function fileIcon(language: EditorLanguage) {
  if (language === 'json') {
    return <FileJson2 className="h-4 w-4 text-amber-500" />;
  }

  return <FileCode2 className="h-4 w-4 text-blue-500" />;
}

export default function CertificateEditorPage() {
  const [files, setFiles] = useState<EditorFile[]>(initialFiles);
  const [activeFileId, setActiveFileId] = useState(initialFiles[0].id);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantInput, setAssistantInput] = useState('');
  const [consoleLines, setConsoleLines] = useState<string[]>([
    'CertiFlow editor initialized.',
    'Ready.'
  ]);
  const [assistantMessages, setAssistantMessages] = useState<
    AssistantMessage[]
  >([
    {
      role: 'assistant',
      content:
        'Hi! I can help you configure certificate fields and validate your files.'
    }
  ]);

  const lineNumbersRef = useRef<HTMLDivElement | null>(null);

  const activeFile =
    files.find((file) => file.id === activeFileId) ?? files[0];

  const isDark = theme === 'dark';

  const lineNumbers = useMemo(() => {
    const total = Math.max(1, activeFile.content.split('\n').length);

    return Array.from({ length: total }, (_, index) => index + 1).join(
      '\n'
    );
  }, [activeFile.content]);

  const updateActiveFile = (content: string) => {
    setFiles((current) =>
      current.map((file) =>
        file.id === activeFile.id ? { ...file, content } : file
      )
    );
  };

  const handleRun = () => {
    setConsoleLines((current) => [
      ...current,
      `> Running ${activeFile.name}`
    ]);

    try {
      if (activeFile.language === 'json') {
        const result = JSON.parse(activeFile.content);

        const description = Array.isArray(result)
          ? `${result.length} certificate fields found.`
          : 'Configuration object is valid.';

        setConsoleLines((current) => [
          ...current,
          description,
          'Run completed successfully.'
        ]);
      } else {
        setConsoleLines((current) => [
          ...current,
          'Preview script checked.',
          'Run completed successfully.'
        ]);
      }
    } catch (error) {
      setConsoleLines((current) => [
        ...current,
        `Error: ${
          error instanceof Error ? error.message : 'Invalid code'
        }`
      ]);
    }
  };

  const handleSave = () => {
    window.localStorage.setItem(
      'certiflow-editor-files',
      JSON.stringify(files)
    );

    setConsoleLines((current) => [
      ...current,
      'Workspace saved in this browser.'
    ]);
  };

  const handleReset = () => {
    setFiles(initialFiles);
    setActiveFileId(initialFiles[0].id);
    setConsoleLines([
      'Workspace reset.',
      'Ready.'
    ]);
  };

  const handleAssistantSubmit = () => {
    const question = assistantInput.trim();

    if (!question) return;

    let answer =
      'Use Run to validate the active file. JSON errors will appear in the console.';

    const normalizedQuestion = question.toLowerCase();

    if (normalizedQuestion.includes('field')) {
      answer =
        'Add certificate fields inside fields.json. Each field should include field, x, y, width, fontSize, fontFamily, color and align.';
    } else if (normalizedQuestion.includes('save')) {
      answer =
        'Click Save in the toolbar. This version stores the workspace in the browser.';
    } else if (normalizedQuestion.includes('date')) {
      answer =
        'Set issueDateMode to current_date for today, or manual and provide an issueDateValue.';
    }

    setAssistantMessages((current) => [
      ...current,
      {
        role: 'user',
        content: question
      },
      {
        role: 'assistant',
        content: answer
      }
    ]);

    setAssistantInput('');
  };

  return (
    <div
      className={[
        'overflow-hidden rounded-[28px] border shadow-[0_18px_60px_rgba(15,23,42,0.10)]',
        isDark
          ? 'border-slate-700 bg-slate-950 text-slate-100'
          : 'border-slate-200 bg-white text-slate-900'
      ].join(' ')}
    >
      {/* Toolbar */}
      <header
        className={[
          'flex min-h-16 flex-wrap items-center justify-between gap-3 border-b px-4 py-3',
          isDark
            ? 'border-slate-700 bg-slate-900'
            : 'border-slate-200 bg-white'
        ].join(' ')}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
            Certificate editor
          </p>
          <h1 className="mt-1 font-semibold">
            Certificate workspace
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeFile.language}
            onChange={(event) => {
              const language = event.target.value as EditorLanguage;

              setFiles((current) =>
                current.map((file) =>
                  file.id === activeFile.id
                    ? { ...file, language }
                    : file
                )
              );
            }}
            className={[
              'h-10 rounded-xl border px-3 text-sm outline-none',
              isDark
                ? 'border-slate-700 bg-slate-800'
                : 'border-slate-200 bg-slate-50'
            ].join(' ')}
          >
            <option value="json">JSON</option>
            <option value="javascript">JavaScript</option>
            <option value="plaintext">Plain text</option>
          </select>

          <button
            type="button"
            onClick={handleRun}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Play className="h-4 w-4" />
            Run
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={[
              'inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold',
              isDark
                ? 'border-slate-700 hover:bg-slate-800'
                : 'border-slate-200 hover:bg-slate-50'
            ].join(' ')}
          >
            <Save className="h-4 w-4" />
            Save
          </button>

          <button
            type="button"
            onClick={handleReset}
            className={[
              'inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold',
              isDark
                ? 'border-slate-700 hover:bg-slate-800'
                : 'border-slate-200 hover:bg-slate-50'
            ].join(' ')}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          <button
            type="button"
            onClick={() =>
              setTheme((current) =>
                current === 'light' ? 'dark' : 'light'
              )
            }
            aria-label="Toggle theme"
            className={[
              'grid h-10 w-10 place-items-center rounded-xl border',
              isDark
                ? 'border-slate-700 hover:bg-slate-800'
                : 'border-slate-200 hover:bg-slate-50'
            ].join(' ')}
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setAssistantOpen((current) => !current)}
            aria-label="Toggle assistant"
            className={[
              'grid h-10 w-10 place-items-center rounded-xl border',
              assistantOpen
                ? 'border-blue-600 bg-blue-600 text-white'
                : isDark
                  ? 'border-slate-700'
                  : 'border-slate-200'
            ].join(' ')}
          >
            {assistantOpen ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      <div
        className={[
          'grid min-h-[680px] grid-cols-1',
          assistantOpen
            ? 'xl:grid-cols-[210px_minmax(0,1fr)_300px]'
            : 'xl:grid-cols-[210px_minmax(0,1fr)]'
        ].join(' ')}
      >
        {/* File explorer */}
        <aside
          className={[
            'border-r',
            isDark
              ? 'border-slate-700 bg-slate-900'
              : 'border-slate-200 bg-slate-50'
          ].join(' ')}
        >
          <div className="border-b border-inherit px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Explorer
            </p>
          </div>

          <div className="p-2">
            <p className="px-3 py-2 text-xs font-semibold text-slate-500">
              CERTIFICATE FILES
            </p>

            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveFileId(file.id)}
                className={[
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm',
                  file.id === activeFile.id
                    ? isDark
                      ? 'bg-slate-800 text-white'
                      : 'bg-blue-100 text-blue-800'
                    : isDark
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-white'
                ].join(' ')}
              >
                {fileIcon(file.language)}
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Editor and console */}
        <main className="grid min-w-0 grid-rows-[auto_minmax(420px,1fr)_180px]">
          {/* Tabs */}
          <div
            className={[
              'flex min-w-0 overflow-x-auto border-b',
              isDark
                ? 'border-slate-700 bg-slate-900'
                : 'border-slate-200 bg-slate-50'
            ].join(' ')}
          >
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveFileId(file.id)}
                className={[
                  'flex min-w-[150px] items-center gap-2 border-r border-inherit px-4 py-3 text-sm',
                  file.id === activeFile.id
                    ? isDark
                      ? 'border-t-2 border-t-blue-500 bg-slate-950'
                      : 'border-t-2 border-t-blue-600 bg-white'
                    : 'text-slate-500'
                ].join(' ')}
              >
                {fileIcon(file.language)}
                <span className="truncate">{file.name}</span>

                {file.id === activeFile.id ? (
                  <X className="ml-auto h-3.5 w-3.5 opacity-50" />
                ) : null}
              </button>
            ))}
          </div>

          {/* Main code editor */}
          <div
            className={[
              'grid min-h-0 grid-cols-[54px_minmax(0,1fr)] overflow-hidden',
              isDark ? 'bg-slate-950' : 'bg-white'
            ].join(' ')}
          >
            <div
              ref={lineNumbersRef}
              aria-hidden="true"
              className={[
                'overflow-hidden border-r px-3 py-4 text-right font-mono text-sm leading-6 select-none',
                isDark
                  ? 'border-slate-800 bg-slate-900 text-slate-600'
                  : 'border-slate-100 bg-slate-50 text-slate-400'
              ].join(' ')}
            >
              <pre>{lineNumbers}</pre>
            </div>

            <textarea
              value={activeFile.content}
              spellCheck={false}
              onChange={(event) =>
                updateActiveFile(event.target.value)
              }
              onScroll={(event) => {
                if (lineNumbersRef.current) {
                  lineNumbersRef.current.scrollTop =
                    event.currentTarget.scrollTop;
                }
              }}
              className={[
                'h-full w-full resize-none overflow-auto whitespace-pre p-4 font-mono text-sm leading-6 outline-none',
                isDark
                  ? 'bg-slate-950 text-slate-200 caret-blue-400'
                  : 'bg-white text-slate-800 caret-blue-600'
              ].join(' ')}
            />
          </div>

          {/* Output console */}
          <section
            className={[
              'min-h-0 border-t',
              isDark
                ? 'border-slate-700 bg-slate-900'
                : 'border-slate-200 bg-slate-50'
            ].join(' ')}
          >
            <div className="flex items-center justify-between border-b border-inherit px-4 py-2">
              <div className="flex gap-5 text-xs font-semibold uppercase tracking-[0.12em]">
                <span className="text-blue-500">Output</span>
                <span className="text-slate-500">Console</span>
              </div>

              <button
                type="button"
                onClick={() => setConsoleLines([])}
                className="text-xs font-medium text-slate-500 hover:text-blue-500"
              >
                Clear
              </button>
            </div>

            <div className="h-[138px] overflow-auto p-4 font-mono text-xs leading-6">
              {consoleLines.length > 0 ? (
                consoleLines.map((line, index) => (
                  <p
                    key={`${line}-${index}`}
                    className={
                      line.toLowerCase().includes('error')
                        ? 'text-red-500'
                        : line.toLowerCase().includes('success')
                          ? 'text-emerald-500'
                          : ''
                    }
                  >
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-slate-500">No output.</p>
              )}
            </div>
          </section>
        </main>

        {/* AI assistant */}
        {assistantOpen ? (
          <aside
            className={[
              'flex min-h-[500px] flex-col border-l',
              isDark
                ? 'border-slate-700 bg-slate-900'
                : 'border-slate-200 bg-white'
            ].join(' ')}
          >
            <div className="flex items-center justify-between border-b border-inherit px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white">
                  <Bot className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-semibold">AI Assistant</p>
                  <p className="text-xs text-emerald-500">
                    Ready to help
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-auto p-4">
              {assistantMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={[
                    'max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-6',
                    message.role === 'user'
                      ? 'ml-auto bg-blue-600 text-white'
                      : isDark
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-slate-100 text-slate-700'
                  ].join(' ')}
                >
                  {message.content}
                </div>
              ))}
            </div>

            <div className="border-t border-inherit p-3">
              <div
                className={[
                  'flex items-end gap-2 rounded-2xl border p-2',
                  isDark
                    ? 'border-slate-700 bg-slate-800'
                    : 'border-slate-200 bg-slate-50'
                ].join(' ')}
              >
                <textarea
                  value={assistantInput}
                  rows={2}
                  placeholder="Ask about the certificate..."
                  onChange={(event) =>
                    setAssistantInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      handleAssistantSubmit();
                    }
                  }}
                  className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
                />

                <button
                  type="button"
                  onClick={handleAssistantSubmit}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}