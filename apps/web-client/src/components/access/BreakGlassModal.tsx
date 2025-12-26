import React, { useState } from 'react';
import { accessApi } from '../../services/accessApi';

interface BreakGlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  collectionId: string;
  recordId?: string; // Optional if breaking glass for entire collection
}

export const BreakGlassModal: React.FC<BreakGlassModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  collectionId, 
  recordId 
}) => {
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (justification.length < 10) {
      setError('Justification must be at least 10 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await accessApi.requestBreakGlass(
        collectionId, 
        'emergency', // Default reason code for now
        justification, 
        recordId
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Break glass failed', err);
      setError(err.response?.data?.message || 'Failed to request access.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center mb-4 text-red-600">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold">Emergency Access Required</h2>
          </div>
          
          <p className="text-gray-600 mb-6">
            You are attempting to access protected information. This action will be audited and logged. 
            Please provide a justification for this emergency access ("Break Glass").
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 h-24 focus:ring-red-500 focus:border-red-500"
                placeholder="Explain why you need access to this data..."
                value={justification}
                onChange={e => setJustification(e.target.value)}
                required
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Requesting...' : 'Break Glass & Access'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
