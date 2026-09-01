import React from 'react';
import { Coins } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

/**
 * Live credit balance for the Code Testing header.
 *
 * NO POLLING HERE, deliberately. `useCreditSocket()` is mounted once at
 * App.js and pushes every `credits:update` into the profile slice, which
 * creditService emits after each balance change. Reading `user.creditAccount`
 * from Redux therefore updates on its own the moment the meter debits — the
 * balance visibly falls WHILE a run is going, with no refresh and no second
 * timer competing with the socket.
 *
 * The number is display-only. The decision to allow a run belongs to the
 * server (see PathSelector's preflight note); a balance the page holds could
 * be stale or edited, and gating on it would be theatre.
 */
export default function CreditBalanceBadge() {
  const { user } = useSelector((state) => state.profile);
  const account = user?.creditAccount;
  if (!account) return null;

  const unlimited = account.unlimited === true;
  const balance = account.balance ?? 0;
  const reserved = account.reserved ?? 0;
  const low = !unlimited && balance <= 10;

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
          low ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
        }`}
        title={
          reserved > 0
            ? `${reserved.toLocaleString()} credit(s) reserved by runs in progress`
            : 'Credits meter our capacity — your provider key is billed separately by the provider.'
        }
      >
        <Coins size={13} className={low ? 'text-red-500' : 'text-gray-400'} />
        <span
          className={`text-xs font-semibold tabular-nums ${
            low ? 'text-red-700' : 'text-gray-700'
          }`}
        >
          {unlimited ? 'Unlimited' : balance.toLocaleString()}
        </span>
        {!unlimited && <span className="text-[10px] text-gray-400">credits</span>}
      </div>
      {low && user?.role === 'company_admin' && (
        <Link
          to="/upgrade-plan"
          className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap"
        >
          Top up →
        </Link>
      )}
    </div>
  );
}
