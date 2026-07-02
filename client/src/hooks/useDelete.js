import { useState } from 'react';
import { axios } from '../store/useAuthStore';
import useAuthStore from '../store/useAuthStore';

/**
 * Reusable delete hook — wraps modal state + API call + toast feedback.
 * Must be called inside a React component or another custom hook.
 *
 * IMPORTANT: `onSuccess` is captured at hook initialisation time.
 * Pass a stable reference (e.g. the fetchXxx function defined outside
 * useEffect) to avoid stale-closure issues.
 */
export const useDelete = ({ endpoint, onSuccess, label = 'Item' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedName, setSelectedName] = useState('');
  const [loading, setLoading] = useState(false);

  // useAuthStore() is called as a proper React hook here — this is valid
  // because useDelete is itself a custom hook always called at the top level
  // of a component.
  const addToast = useAuthStore((state) => state.addToast);

  const triggerDelete = (id, name = '') => {
    setSelectedId(id);
    setSelectedName(name);
    setIsOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await axios.delete(`${endpoint}/${selectedId}`);
      addToast(res.data?.message || `${label} deleted successfully`, 'success');
      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(`Error deleting ${label}:`, err);
      const errorMsg = err.response?.data?.message || `Failed to delete ${label}`;
      addToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setIsOpen(false);
    setSelectedId(null);
    setSelectedName('');
  };

  return {
    isOpen,
    selectedName,
    loading,
    triggerDelete,
    confirmDelete,
    cancelDelete
  };
};
