import type * as mapkitjs from "apple-mapkit-js-browser";

declare global {
  interface Window {
    mapkit: typeof mapkitjs;
  }
}
