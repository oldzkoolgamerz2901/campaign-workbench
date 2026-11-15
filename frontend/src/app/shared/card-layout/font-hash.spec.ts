import { describe, it, expect } from 'vitest';
import { sha256 } from './font-hash';
describe('HTTP font SHA-256', () => {
  it('matches standard empty, abc and multiblock vectors', () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(sha256(encode(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256(encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256(encode('a'.repeat(1000000)))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });
});
