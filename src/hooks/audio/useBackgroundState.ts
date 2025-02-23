import { useState, useEffect } from 'react';
import { Howl } from 'howler';

interface UseBackgroundStateProps {
  activeHowl: Howl | null;
  isPlaying: boolean;
  playAudio: () => void;
}

export function useBackgroundState({ activeHowl, isPlaying, playAudio }: UseBackgroundStateProps) {
  const [isBackgrounded, setIsBackgrounded] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsBackgrounded(document.hidden);
      if (document.hidden) {
        // When backgrounded, pause audio but maintain isPlaying state
        if (activeHowl) {
          activeHowl.pause();
        }
      } else if (isPlaying) {
        // When returning to foreground, resume from current position
        if (activeHowl) {
          activeHowl.play();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, activeHowl, playAudio]);

  return isBackgrounded;
}