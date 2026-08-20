import type { DocumentLink } from "@/data/loans";

export function DocumentLinks({ documents }: { documents?: DocumentLink[] }) {
  if (!documents || documents.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--cream-2)] pt-4">
      {documents.map((doc) => (
        <a
          key={doc.path}
          href={`/documents/${doc.path}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--azure)]/40 bg-[var(--paper)]/60 px-3 py-1 text-xs font-medium text-[var(--azure-deep)] transition hover:bg-[var(--paper)]"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path
              d="M4 1.5h5l3 3v10a.5.5 0 0 1-.5.5h-7.5a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5Z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path d="M9 1.5V4.5H12" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
          {doc.label}
        </a>
      ))}
    </div>
  );
}
