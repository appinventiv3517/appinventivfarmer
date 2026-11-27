import { useCallback } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router-dom';
import { to } from './paths';

/** navigate() for Kisani Didi paths ('/tasks' → '/didi/tasks'). */
export function useNav() {
  const navigate = useNavigate();
  return useCallback(
    (path: string | number, options?: NavigateOptions) => {
      if (typeof path === 'number') navigate(path);
      else navigate(to(path), options);
    },
    [navigate],
  );
}
