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

    // update usage without fetching the whole profile again
    incrementUsageCount: (state, action) => {
      if (state.user && state.user.subscription && state.user.subscription.length > 0) {
        // Get the latest subscription
        const latestSubIndex = state.user.subscription.length - 1;
        
        // Update the testsUsed value with the payload from the backend
        state.user.subscription[latestSubIndex].planDetails.testsUsed = action.payload;
      }}
  },
})

export const { setUser, setLoading, setSelectedMode, incrementUsageCount  } = profileSlice.actions

export default profileSlice.reducer
