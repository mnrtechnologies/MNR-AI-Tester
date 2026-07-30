import { createSlice } from "@reduxjs/toolkit"

const initialState = {
  user: null,
  loading: false,
  selectedMode: null,//audio/csv bot
}

const profileSlice = createSlice({
  name: "profile",
  initialState: initialState,
  reducers: {
    setUser(state, value) {
      state.user = value.payload
    },
    setLoading(state, value) {
      state.loading = value.payload
    },
    setSelectedMode(state, value) { 
      state.selectedMode = value.payload
    },

    /**
     * Replace the whole credit account — after login, getUserDetails, or any
     * credit call that returns a fresh snapshot.
     *
     * (This replaces `incrementUsageCount`, which wrote to
     * `state.user.subscription[…]` — an array the backend has never sent. It
     * was a permanent no-op, so the usage meter never updated live.)
     */
    setCreditAccount(state, action) {
      if (state.user) state.user.creditAccount = action.payload;
    },

    /**
     * Patch just the balance/reserved numbers, so the header pill and the
     * guard react immediately after a hold or a settle without refetching
     * the entire profile.
     */
    applyCreditDelta(state, action) {
      if (!state.user || !state.user.creditAccount) return;
      const { balance, reserved } = action.payload || {};
      if (typeof balance === "number") state.user.creditAccount.balance = balance;
      if (typeof reserved === "number") state.user.creditAccount.reserved = reserved;
    },

    /**
     * Provider rates for the live spend meter. Sent only to Managed plans,
     * because only they are billed on tokens — a capacity-plan customer never
     * receives these and the meter stays inert.
     */
    setCreditRates(state, action) {
      if (!state.user) return;
      state.user.creditModelRates = action.payload?.modelRates || null;
      state.user.usdPerCredit = action.payload?.usdPerCredit || null;
    },
  },
})

export const {
  setUser,
  setLoading,
  setSelectedMode,
  setCreditAccount,
  applyCreditDelta,
  setCreditRates,
} = profileSlice.actions

export default profileSlice.reducer
