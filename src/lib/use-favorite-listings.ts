import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialog } from '@/components/AppDialog';
import { apiError } from '@/lib/api-error';
import { getFavoriteIds, toggleFavorite } from '@/services/favoriteApi';

/**
 * Shared favorite-heart state for listing cards: the saved id set plus an optimistic
 * `toggle` that rolls back and reports through `useDialog` when the server call fails.
 * `onToggled` runs after the server confirms (e.g. drop the row from the Favorites list).
 */
export function useFavoriteListings({
  autoLoad = true,
  onToggled,
}: { autoLoad?: boolean; onToggled?: (id: string, saved: boolean) => void } = {}) {
  const showDialog = useDialog();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());
  const onToggledRef = useRef(onToggled);
  onToggledRef.current = onToggled;

  const loadIds = useCallback(async () => {
    try {
      setFavoriteIds(new Set(await getFavoriteIds()));
    } catch {
      // Hearts stay empty; a toggle still reports the server state.
    }
  }, []);
  useEffect(() => {
    if (autoLoad) void loadIds();
  }, [autoLoad, loadIds]);

  const setFavorite = useCallback((id: string, value: boolean) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback(
    async (id: string) => {
      if (pending.current.has(id)) return;
      pending.current.add(id);
      const before = favoriteIds.has(id);
      setFavorite(id, !before); // optimistic
      try {
        const saved = await toggleFavorite(id);
        setFavorite(id, saved);
        onToggledRef.current?.(id, saved);
      } catch (cause) {
        setFavorite(id, before);
        showDialog('Chưa cập nhật được yêu thích', apiError(cause));
      } finally {
        pending.current.delete(id);
      }
    },
    [favoriteIds, setFavorite, showDialog]
  );

  return { favoriteIds, setFavoriteIds, loadIds, toggle };
}
