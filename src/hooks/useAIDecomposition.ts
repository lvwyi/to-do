import { useState, useCallback } from 'react';
import type { Category } from '../types';
import { decomposeTask, type DecompositionResult } from '../api/llm';

/** Extended result with selection state for UI */
export interface AIResult extends DecompositionResult {
  selected: boolean;
}

export interface UseAIDecompositionReturn {
  loading: boolean;
  error: string | null;
  results: AIResult[] | null;
  /** Start decomposing a task description */
  decompose: (description: string, context: string, categories: Category[]) => Promise<void>;
  selectAll: (value: boolean) => void;
  toggleSelect: (id: string) => void;
  reset: () => void;
}

export function useAIDecomposition(): UseAIDecompositionReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AIResult[] | null>(null);

  const decompose = useCallback(async (
    description: string,
    context: string,
    categories: Category[],
  ) => {
    setLoading(true);
    setError(null);

    try {
      const rawResults = await decomposeTask(description, context, categories);
      setResults(rawResults.map(r => ({ ...r, selected: false })));
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectAll = useCallback((value: boolean) => {
    setResults(prev => prev?.map(r => ({ ...r, selected: value })) ?? null);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setResults(prev => prev?.map(r => r.id === id ? { ...r, selected: !r.selected } : r) ?? null);
  }, []);

  const reset = useCallback(() => {
    setResults(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    loading, error, results,
    decompose, selectAll, toggleSelect, reset,
  };
}
