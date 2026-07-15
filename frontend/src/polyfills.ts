import { Buffer } from 'buffer';

if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

if (typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {},
    nextTick: (fn: () => void) => setTimeout(fn, 0),
  };
}

if (typeof (window as any).Buffer === 'undefined') {
  (window as any).Buffer = Buffer;
}
