import React, { useState } from 'react';
import { Github, LogOut, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../api';

/**
 * The connected-account chip, with disconnect.
 *
 * Lives in the page header rather than inside ConnectGitHub, because that
 * component only renders on the "not connected" screen -- so its disconnect
 * button was unreachable the moment you actually connected an account. Any
 * control for undoing a state must be visible while you are IN that state.
 */
export default function GitHubAccountBadge({ status, onDisconnected }) {
  const [busy, setBusy] = useState(false);

  if (!status?.connected) return null;

  const disconnect = async () => {
    const ok = window.confirm(
      `Disconnect ${status.login} from GitHub Code Testing?\n\n` +
      'Your existing analyses and run history are kept. You will need to reconnect before starting new runs.'
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await apiFetch('/github/disconnect', { method: 'DELETE' });
      // Be honest about how complete the disconnect actually was: if we could
      // not revoke the token at GitHub, the user may want to remove the app
      // authorisation themselves.
      if (res?.revokedAtGitHub) {
        toast.success('GitHub disconnected and the access token was revoked.');
      } else {
        toast.success('GitHub disconnected.');
        toast('Revoke the app in GitHub settings if you want the old token fully invalidated.', {
          icon: 'ℹ️', duration: 7000,
        });
      }
      onDisconnected();
    } catch (err) {
      toast.error(err.message || 'Could not disconnect GitHub.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 border rounded-full pl-1 pr-1 py-1 bg-white">
      {status.avatarUrl ? (
        <img src={status.avatarUrl} alt={status.login} className="w-6 h-6 rounded-full" />
      ) : (
        <Github size={16} className="text-gray-600 ml-1" />
      )}
      <span className="text-xs text-gray-600 max-w-[140px] truncate">{status.login}</span>
      <button
        onClick={disconnect}
        disabled={busy}
        title="Disconnect GitHub"
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full px-2 py-1 disabled:opacity-60"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
        Disconnect
      </button>
    </div>
  );
}
