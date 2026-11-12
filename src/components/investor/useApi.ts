"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ApiState<T> {
  data?: T;
  error?: string;
}

/** Loads a GET route once on mount. Always fresh: the store changes as the demo runs. */
export function useApi<T>(path: string) {
  const [state, setState] = useState<ApiState<T>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api<T>(path).then(
      (data) => live && setState({ data }),
      (e: Error) => live && setState({ error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [path, attempt]);

  return {
    data: state.data,
    error: state.error,
    loading: !state.data && !state.error,
    retry: () => {
      setState({});
      setAttempt((n) => n + 1);
    },
  };
}
