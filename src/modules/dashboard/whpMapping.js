import { state } from '../../state/appState.js';

// Shared by distribution.js and summary.js (extracted to its own module so
// neither of those two files needs to import the other, avoiding a circular
// dependency between them).
export function getWHP(branchKey) {
  for (let whp in state.gData.whpMapping) {
    if (state.gData.whpMapping[whp].some(b => branchKey.includes(b))) return whp;
  }
  return null;
}
