import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CommentSubmission = { text: string; attachments: string[] };

/**
 * Shared comment box used for escalations, resolutions, and cross-functional
 * dependency tagging. Stores attachments as data URLs (prototype-grade).
 */
export function CommentBoxWithMedia({
  placeholder = 'Add a note',
  required = false,
  onChange,
  rows = 3,
  initialText = '',
}: {
  placeholder?: string;
  required?: boolean;
  rows?: number;
  initialText?: string;
  onChange: (s: CommentSubmission) => void;
}) {
  const [text, setText] = useState(initialText);
  const [files, setFiles] = useState<{ name: string; dataUrl: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const emit = (nextText: string, nextFiles: typeof files) => {
    onChange({ text: nextText, attachments: nextFiles.map(f => f.dataUrl) });
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const data = await Promise.all(picked.slice(0, 5).map(f => new Promise<{ name: string; dataUrl: string }>((res, rej) => {
      if (f.size > 5 * 1024 * 1024) { rej(new Error('Max 5MB')); return; }
      const r = new FileReader();
      r.onload = () => res({ name: f.name, dataUrl: String(r.result) });
      r.onerror = () => rej(r.error);
      r.readAsDataURL(f);
    }))).catch(() => []);
    const next = [...files, ...data].slice(0, 5);
    setFiles(next);
    emit(text, next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    emit(text, next);
  };

  return (
    <div className="space-y-1.5">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); emit(e.target.value, files); }}
        rows={rows}
        placeholder={placeholder + (required ? ' *' : '')}
        className="w-full text-xs bg-secondary border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:border-primary/50"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[10px] px-2 py-1 rounded border bg-secondary border-border hover:bg-accent flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-3 w-3" /> Add media
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
        <span className="text-[9px] text-muted-foreground">{files.length}/5 attached · images, max 5MB each</span>
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {files.map((f, i) => (
            <div key={i} className={cn('relative group rounded border border-border overflow-hidden bg-secondary')}>
              <img src={f.dataUrl} alt={f.name} className="h-12 w-12 object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-0 right-0 p-0.5 bg-background/80 rounded-bl hover:bg-destructive/30"
                aria-label="Remove"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render attachments inline (used by the Activity Log). */
export function AttachmentThumbs({ urls }: { urls: string[] | undefined }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noreferrer"
          className="block h-10 w-10 rounded border border-border overflow-hidden bg-secondary">
          <img src={u} alt={`attachment-${i + 1}`} className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}
