/// <reference types="vite/client" />

import type { NotateAPI } from '../../preload/index.js';

declare global {
  interface Window {
    notateAPI: NotateAPI;
  }
}

export {};
