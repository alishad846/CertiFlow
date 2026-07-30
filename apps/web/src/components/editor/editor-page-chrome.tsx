'use client';

export function isAuthError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('not authenticated') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('session expired')
  );
}

export function EditorFullScreenLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0b1b3a]">
      <div className="h-10 w-10 animate-pulse rounded-full bg-white/20" />
    </div>
  );
}

export function EditorFullScreenError({ message }: { message: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0b1b3a] text-white">
      <p className="text-sm">{message}</p>
    </div>
  );
}
