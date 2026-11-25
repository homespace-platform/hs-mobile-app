// The web's "#id" anchors and scrollIntoView, for a ScrollView.
import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { View, type ScrollView } from 'react-native';

export type Anchors = {
  register: (id: string, view: View | null) => void;
  laidOut: (id: string) => void;
  /** Scrolls now, or as soon as the anchor appears (a tab that is about to be drawn). */
  scrollTo: (id: string) => void;
  /** Scrolls once the anchor is laid out again, even if it is currently mounted. */
  scrollWhenDrawn: (id: string) => void;
};

/** A requested anchor that never appears (e.g. no document section on this page) is forgotten. */
const PENDING_MS = 3000;

const AnchorContext = createContext<Anchors | null>(null);
export const AnchorProvider = AnchorContext.Provider;
export const useAnchors = () => useContext(AnchorContext);

/** `content` is the View that wraps everything inside the ScrollView. */
export function useAnchorController(
  scroll: RefObject<ScrollView | null>,
  content: RefObject<View | null>
): Anchors {
  const views = useRef(new Map<string, View>());
  const pending = useRef<{ id: string; until: number } | null>(null);
  return useMemo(() => {
    const go = (view: View) => {
      if (!content.current) return;
      view.measureLayout(
        content.current,
        (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: true }),
        () => {}
      );
    };
    const remember = (id: string) => {
      pending.current = { id, until: Date.now() + PENDING_MS };
    };
    return {
      register(id, view) {
        if (view) views.current.set(id, view);
        else views.current.delete(id);
      },
      laidOut(id) {
        const wanted = pending.current;
        const view = views.current.get(id);
        if (!view || wanted?.id !== id) return;
        pending.current = null;
        if (Date.now() <= wanted.until) go(view);
      },
      scrollTo(id) {
        const view = views.current.get(id);
        if (view) go(view);
        else remember(id);
      },
      scrollWhenDrawn: remember,
    };
  }, [scroll, content]);
}

export function Anchor({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const anchors = useAnchors();
  return (
    <View
      collapsable={false}
      nativeID={id}
      ref={(view) => anchors?.register(id, view)}
      onLayout={() => anchors?.laidOut(id)}
      className={className}>
      {children}
    </View>
  );
}
