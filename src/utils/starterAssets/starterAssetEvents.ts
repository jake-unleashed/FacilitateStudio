export const STARTER_ASSETS_UPDATED_EVENT = 'facilitate:starter-assets-updated';

export function emitStarterAssetsUpdated(assetIds: string[]): void {
  if (typeof window === 'undefined' || assetIds.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<string[]>(STARTER_ASSETS_UPDATED_EVENT, {
      detail: assetIds,
    })
  );
}

export function subscribeToStarterAssetsUpdated(
  listener: (assetIds: string[]) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleEvent: EventListener = (event) => {
    const assetIds = (event as CustomEvent<string[] | undefined>).detail;
    listener(Array.isArray(assetIds) ? assetIds : []);
  };

  window.addEventListener(STARTER_ASSETS_UPDATED_EVENT, handleEvent);
  return () => {
    window.removeEventListener(STARTER_ASSETS_UPDATED_EVENT, handleEvent);
  };
}
