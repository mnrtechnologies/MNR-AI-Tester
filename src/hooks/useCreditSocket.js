import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import socket from "../utils/socket";
import { setCreditAccount } from "../slices/profileSlice";

/**
 * Keep the credit balance live across the whole app.
 *
 * The server pushes `credits:update` to a company room after every balance
 * change, so the header badge, the run guard and the usage meter all move
 * together — including when the change was caused by a TEAMMATE's run, which
 * polling on one screen would never reveal.
 *
 * Mount this ONCE, at the app root. Mounting it per-screen would register
 * duplicate listeners and dispatch the same update several times.
 *
 * This is an optimisation, not a dependency: every screen still fetches its
 * balance normally, so a dropped socket degrades to the previous behaviour
 * rather than showing a frozen number.
 */
export default function useCreditSocket() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.profile);
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!token || !user?._id) return undefined;

    const handleCreditUpdate = (payload) => {
      if (payload?.account) dispatch(setCreditAccount(payload.account));
    };

    socket.on("credits:update", handleCreditUpdate);
    return () => socket.off("credits:update", handleCreditUpdate);
  }, [dispatch, token, user?._id]);
}
