import { useEffect, useState } from 'react';
import { ThemeResponse, uiService } from '../services/ui.service';

export function useThemeTokens() {
  const [theme, setTheme] = useState<ThemeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    uiService
      .getTheme()
      .then((tokens) => {
        if (isMounted) {
          setTheme(tokens);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { theme, loading };
}
