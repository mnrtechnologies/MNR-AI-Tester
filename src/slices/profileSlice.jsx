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
  },
})

export const { setUser, setLoading, setSelectedMode  } = profileSlice.actions

export default profileSlice.reducer
