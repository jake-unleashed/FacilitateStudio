import { useCallback, useEffect, useRef, useState } from 'react';

export function useDeleteConfirm(onDelete?: () => void): {
  confirmingDelete: boolean;
  handleDeleteClick: () => void;
} {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteClick = useCallback(() => {
    if (confirmingDelete) {
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
        deleteConfirmTimeoutRef.current = null;
      }
      onDelete?.();
      setConfirmingDelete(false);
      return;
    }

    setConfirmingDelete(true);
    if (deleteConfirmTimeoutRef.current) {
      clearTimeout(deleteConfirmTimeoutRef.current);
    }
    deleteConfirmTimeoutRef.current = setTimeout(() => {
      deleteConfirmTimeoutRef.current = null;
      setConfirmingDelete(false);
    }, 3000);
  }, [confirmingDelete, onDelete]);

  useEffect(() => {
    return () => {
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
        deleteConfirmTimeoutRef.current = null;
      }
    };
  }, []);

  return { confirmingDelete, handleDeleteClick };
}

