export const initialState = {
  currentDataset: "jailbreakbench",
  customPrompts: [],
  customFileData: [],
  isRunning: false,
  results: []
};

export function createStore() {
  let state = { ...initialState };

  return {
    getState() {
      return state;
    },
    setState(patch) {
      state = { ...state, ...patch };
      return state;
    },
    reset() {
      state = { ...initialState };
      return state;
    }
  };
}
