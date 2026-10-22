import { HttpErrorResponse } from '@angular/common/http';
import { transferError } from './transfer-error';

describe('Portable transfer failures', () => {
  it('decodes Blob Problem Details from binary downloads and keeps the backend limit/retry explanation', async () => {
    const detail = 'Portable transfer is busy. Retry when the active operation finishes.';
    const error = new HttpErrorResponse({
      status: 503,
      error: new Blob([JSON.stringify({ detail })], { type: 'application/problem+json' }),
    });
    expect(await transferError(error)).toBe(detail);
    expect(
      await transferError(
        new HttpErrorResponse({ status: 422, error: { detail: 'Archive exceeds 256 MiB.' } }),
      ),
    ).toBe('Archive exceeds 256 MiB.');
  });
  it('falls back safely for interrupted or malformed download responses', async () => {
    expect(
      await transferError(new HttpErrorResponse({ status: 0, error: new Blob(['truncated']) })),
    ).toContain('retry');
  });
});
