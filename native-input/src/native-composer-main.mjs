export const AVAILABILITY_CHANNEL = 'dsh:composer-conversion:availability:v1';
export const EVENT_CHANNEL = 'dsh:composer-conversion:event:v1';
let nextMenuId = 0;

/** Capability and document-scoped native composer actions; never transports draft data. */
export function attachNativeComposerMenu({ window, ipcMain }) {
  const webContents = window.webContents;
  let available = false, revision = -1, epoch = 0, state = 0, disposed = false;
  let current = null;
  const live = () => !disposed && !window.isDestroyed() && !webContents.isDestroyed()
    && window.webContents === webContents;
  function trusted(frame) {
    if (!live() || !frame || frame !== webContents.mainFrame) return false;
    try {
      const url = new URL(frame.url);
      return url.protocol === 'dsh-app:' && url.host === 'app' && !url.username && !url.password;
    } catch { return false; }
  }
  function send(packet) {
    try { webContents.send(EVENT_CHANNEL, packet); return true; } catch { return false; }
  }
  function onAvailability(event, payload) {
    if (event?.sender !== webContents || !trusted(event.senderFrame)
      || !payload || typeof payload.available !== 'boolean'
      || !Number.isSafeInteger(payload.revision) || payload.revision < 0
      || payload.revision < revision) return;
    // A duplicate revision cannot change its already-announced state.
    if (payload.revision === revision) return;
    revision = payload.revision;
    available = payload.available;
    state++;
  }
  function reset() {
    available = false;
    revision = -1;
    epoch++;
    current = null;
  }
  function onNavigation(_event, _url, inPlace, isMainFrame) {
    if (!isMainFrame) return;
    if (inPlace) {
      current?.closed();
      epoch++;
      current = null;
    } else reset();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    reset();
    ipcMain.removeListener(AVAILABILITY_CHANNEL, onAvailability);
    webContents.removeListener('did-start-navigation', onNavigation);
    webContents.removeListener('did-navigate', reset);
    webContents.removeListener('render-process-gone', reset);
    webContents.removeListener('destroyed', dispose);
    window.removeListener('closed', dispose);
  }
  function prepare(items, params) {
    const unchanged = { items, closed() {} };
    if (!available || !params || params.isEditable !== true || !trusted(params.frame)
      || params.linkURL || (params.formControlType !== undefined && params.formControlType !== 'none')
      || nextMenuId === Number.MAX_SAFE_INTEGER) return unchanged;
    if (current) current.closed();
    const menuId = ++nextMenuId, frame = params.frame, url = frame.url;
    const menuEpoch = epoch, menuState = state;
    let closed = false, used = false;
    const sameDocument = () => epoch === menuEpoch && trusted(frame) && frame.url === url;
    const token = {
      closed() {
        if (closed) return;
        closed = true;
        if (current === token) current = null;
        if (sameDocument()) send({ kind: 'close', menuId });
      },
    };
    current = token;
    const action = (mode, label) => ({
      id: `dsh-composer-${mode}`, label,
      click() {
        if (closed || used || current !== token || state !== menuState || !available || !sameDocument()) return;
        used = true;
        send({ kind: 'action', menuId, mode });
      },
    });
    if (!send({ kind: 'open', menuId })) {
      closed = true;
      current = null;
      return unchanged;
    }
    return {
      items: [...items, ...(items.length ? [{ type: 'separator' }] : []),
        action('traditional', '轉為繁體'), action('simplified', '轉為簡體')],
      closed: token.closed,
    };
  }
  ipcMain.on(AVAILABILITY_CHANNEL, onAvailability);
  webContents.on('did-start-navigation', onNavigation);
  webContents.on('did-navigate', reset);
  webContents.on('render-process-gone', reset);
  webContents.on('destroyed', dispose);
  window.on('closed', dispose);
  if (!live()) dispose();
  return { prepare, dispose };
}
