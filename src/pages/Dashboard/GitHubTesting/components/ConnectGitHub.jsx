import React, { useEffect, useState } from 'react';
import { Github, Loader2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../api';

/**
 * Screen 1 — Connect GitHub.
 *
 * The OAuth handshake is a real top-level browser navigation (GitHub has to
 * see it as one to show its consent screen), so this does not use apiFetch
 * for the authorize step itself — it fetches the signed authorize URL (which
 * DOES need our bearer token, to bind the OAuth `state` to this user) and
 * then navigates the whole tab there. GitHub redirects back to
 * FRONTEND_GITHUB_RETURN_URL with ?connected=1 or ?error=..., which this
 * component picks up on mount.
 */
export default function ConnectGitHub({ status, loadingStatus, onStatusChange }) {
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast.success('GitHub connected.');
      onStatusChange();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      toast.error(`GitHub connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await apiFetch('/github/authorize');
      window.location.href = url;
    } catch (err) {
      toast.error(err.message || 'Could not start GitHub connection.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiFetch('/github/disconnect', { method: 'DELETE' });
      toast.success('GitHub disconnected.');
      onStatusChange();
    } catch (err) {
      toast.error(err.message || 'Could not disconnect GitHub.');
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="animate-spin" size={16} /> Checking GitHub connection…
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="flex items-center justify-between bg-white border rounded-xl p-4">
        <div className="flex items-center gap-3">
          {status.avatarUrl ? (
            <img src={status.avatarUrl} alt={status.login} className="w-10 h-10 rounded-full" />
          ) : (
            <Github size={32} className="text-gray-700" />
          )}
          <div>
            <p className="text-sm text-gray-500">Connected as</p>
            <p className="font-semibold text-gray-800">{status.login}</p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50"
        >
          <LogOut size={16} /> Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl p-8 text-center">
      <Github size={40} className="mx-auto text-gray-800 mb-3" />
      <h3 className="text-lg font-semibold text-gray-800 mb-1">Connect your GitHub account</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
        We only ever read your repositories — nothing is written back to GitHub. Your access token
        is encrypted at rest and never leaves our backend.
      </p>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-60"
      >
        {connecting ? <Loader2 className="animate-spin" size={18} /> : <Github size={18} />}
        Connect GitHub
      </button>
    </div>
  );
}
