// Self-contained: inline into the existing sandboxed, origin-gated preload.
export function createNativeComposerBridge(ipcRenderer) {
  const AVAILABILITY = 'dsh:composer-conversion:availability:v1';
  const EVENT = 'dsh:composer-conversion:event:v1';
  const subscriptions = new Set();
  let revision = 0;
  function announce() {
    revision++;
    ipcRenderer.send(AVAILABILITY, { available: subscriptions.size > 0, revision });
  }
  function receive(_event, value) {
    if (!value || !Number.isSafeInteger(value.menuId) || value.menuId <= 0
      || !['open', 'action', 'close'].includes(value.kind)
      || (value.kind === 'action' && !['traditional', 'simplified'].includes(value.mode))) return;
    const packet = Object.freeze(value.kind === 'action'
      ? { kind: 'action', menuId: value.menuId, mode: value.mode }
      : { kind: value.kind, menuId: value.menuId });
    for (const subscription of [...subscriptions]) {
      if (!subscriptions.has(subscription)) continue;
      try { subscription.listener(packet); } catch { /* Never expose callback errors or user data. */ }
    }
  }
  return Object.freeze({
    version: 1,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Composer listener must be a function');
      // Reserve a revision for this registration and its eventual disposal.
      if (revision >= Number.MAX_SAFE_INTEGER - subscriptions.size - 1) throw new RangeError('Composer subscription revision exhausted');
      if (!subscriptions.size) ipcRenderer.on(EVENT, receive);
      const subscription = { listener };
      subscriptions.add(subscription);
      announce();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        subscriptions.delete(subscription);
        if (!subscriptions.size) ipcRenderer.removeListener(EVENT, receive);
        announce();
      };
    },
  });
}
