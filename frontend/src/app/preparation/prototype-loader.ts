import { Type } from '@angular/core';

// Replaced by a no-op in production, so the disposable study is not bundled.
export async function loadPreparationPrototype(): Promise<Type<unknown> | null> {
  const module = await import('./prototype/preparation-prototype');
  return module.PreparationPrototype;
}
