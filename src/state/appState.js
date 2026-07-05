// Cross-module mutable state. Kept as a single shared object so every module
// mutates/reads the same live values (equivalent to the original top-level
// `let` globals in the single-script version).
export const state = {
  gData: null,
  pastedDataCache: {},
  branchRankingChart: null,
};
