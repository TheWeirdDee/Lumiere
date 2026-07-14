declare module 'bs58' {
  export function decode(str: string): Uint8Array;
  export function encode(arr: Uint8Array | number[]): string;
}
