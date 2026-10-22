import { HttpErrorResponse } from '@angular/common/http';

export async function transferError(error: unknown): Promise<string> {
  if (error instanceof HttpErrorResponse) {
    let problem = error.error;
    if (problem instanceof Blob) {
      try {
        problem = JSON.parse(await problem.text());
      } catch {
        problem = null;
      }
    }
    if (typeof problem?.detail === 'string') return problem.detail;
  }
  return 'Cannot complete the transfer. Check backend availability and retry.';
}
