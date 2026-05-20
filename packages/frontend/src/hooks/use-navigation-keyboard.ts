import { useCallback, useEffect, useRef } from 'react';

interface UseNavigationKeyboardProps {
  itemCount: number;
  onNavigate: (index: number) => void;
  isCollapsed?: boolean;
}

export function useNavigationKeyboard({
  itemCount,
  onNavigate,
  isCollapsed = false,
}: UseNavigationKeyboardProps) {
  const currentIndex = useRef<number>(0);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      let newIndex = currentIndex.current;

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          newIndex = (currentIndex.current + 1) % itemCount;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          newIndex = (currentIndex.current - 1 + itemCount) % itemCount;
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = itemCount - 1;
          break;
        default:
          return;
      }

      currentIndex.current = newIndex;
      onNavigate(newIndex);
    },
    [itemCount, onNavigate]
  );

  useEffect(() => {
    if (!isCollapsed) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, isCollapsed]);

  return {
    currentIndex: currentIndex.current,
  };
}