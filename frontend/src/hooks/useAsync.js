import { useCallback, useState } from 'react';

export function useAsync(asyncFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(
    async (...args) => {
      setLoading(true);
      setError('');
      try {
        return await asyncFn(...args);
      } catch (err) {
        setError(err.friendlyMessage || 'Request failed. Please retry.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn],
  );

  return { run, loading, error, setError };
}
