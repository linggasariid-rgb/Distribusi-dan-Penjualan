import { callApi } from './api.js';

export function attemptLogin(username, password) {
  return callApi('login', username, password);
}
