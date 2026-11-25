import { useEffect, useRef } from 'react';

import { discardPickedCopy } from '@/services/rental/cache';
import type { LocalFile } from '@/services/storageApi';

/**
 * For the state that holds a draft's picked files: deletes a picker copy once the draft lets it go
 * (removed, replaced, cleared after a send, or the draft's screen closed). A failed send keeps its
 * files in that state, so the retry still finds them. A copy that an upload or send still needs is
 * leased (`withFileLease`), so it goes only when that settles.
 */
export function useDiscardDroppedFiles(files: readonly (LocalFile | null | undefined)[]) {
  const held = useRef<string[]>([]);
  useEffect(() => {
    const next = files.flatMap((file) => (file ? [file.uri] : []));
    for (const uri of held.current) if (!next.includes(uri)) void discardPickedCopy(uri);
    held.current = next;
  });
  useEffect(
    () => () => {
      const left = held.current;
      held.current = [];
      left.forEach((uri) => void discardPickedCopy(uri));
    },
    []
  );
}
