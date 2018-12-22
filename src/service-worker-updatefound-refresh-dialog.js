// Based on these receipts
// https://github.com/deanhume/pwa-update-available
// https://developers.google.com/web/tools/workbox/guides/advanced-recipes
const isServiceWorker = 'ServiceWorkerGlobalScope' in self
    && self instanceof ServiceWorkerGlobalScope;
// *1 in sw.js
// receive "skipWaiting" message and invoke `skipWaiting()`
if (isServiceWorker) {
    self.addEventListener("message", event => {
        if (!event.data) {
            return;
        }
        if (event.data === "skipWaiting") {
            self.skipWaiting();
        }
    });
}

function defaultOnClickHandler(registration) {
    if (!registration.waiting) {
        // Just to ensure registration.waiting is available before
        // calling postMessage()
        return;
    }
    // post message to sw.js ===> *1
    registration.waiting.postMessage("skipWaiting");
}

function showRefreshUI(registration, { message, onClick }) {
    var dialog = document.createElement("button");
    dialog.id = "service-worker-updatefound-refresh-dialog";
    dialog.dataset.testid = "service-worker-updatefound-refresh-dialog-button";
    dialog.style = `
      min-width: var(--sw-updatefound-refresh-dialog--min-width, 250px);
      color: var(--sw-updatefound-refresh-dialog--color, #fff);
      background-color: var(--sw-updatefound-refresh-dialog--background-color, #333);
      text-align: var(--sw-updatefound-refresh-dialog--text-align, center);
      border-radius: var(--sw-updatefound-refresh-dialog--border-radius, 2px);
      padding: var(--sw-updatefound-refresh-dialog--padding, 16px);
      position: var(--sw-updatefound-refresh-dialog--position, fixed);
      z-index: var(--sw-updatefound-refresh-dialog--z-index, 1);
      left: var(--sw-updatefound-refresh-dialog--left, initial);
      right: var(--sw-updatefound-refresh-dialog--right, 5%);
      top: var(--sw-updatefound-refresh-dialog--top, initial);
      bottom: var(--sw-updatefound-refresh-dialog--bottom, 30px);
      transition: var(--sw-updatefound-refresh-dialog--transition, opacity 0.5s ease-out);
`;
    dialog.textContent = message;

    var listener = function() {
        dialog.disabled = true;
        dialog.style.opacity = 0;
        dialog.removeEventListener("click", listener);
        onClick(registration);
    };
    dialog.addEventListener("click", listener);

    document.body.appendChild(dialog);
}

function onNewServiceWorker(registration, callback, options = { forceUpdate: false }) {
    if (registration.waiting) {
        // SW is waiting to activate. Can occur if multiple clients open and
        // one of the clients is refreshed.
        return callback();
    }

    function listenInstalledStateChange() {
        registration.installing.addEventListener("statechange", function(event) {
            if (event.target.state === "installed") {
                // A new service worker is available, inform the user
                callback();
            }
        });
    }

    if (registration.installing) {
        return listenInstalledStateChange();
    }

    // We are currently controlled so a new SW may be found...
    // Add a listener in case a new SW is found,
    registration.addEventListener("updatefound", listenInstalledStateChange);

    if (options.forceUpdate) {
        callback();
    }
}

/**
 * Register events to Service Worker's registration
 * @param {ServiceWorkerRegistration} registration
 * @param {{ message?:string, onClick?: function, forceUpdate?:boolean}}options
 */
export function register(registration, options = {}) {
    var message = options.message || "A new version of this page is available. Click here to update.";
    var onClick = options.onClick || defaultOnClickHandler;
    var forceUpdate = options.forceUpdate !== undefined ? options.forceUpdate : false;
    // Track updates to the Service Worker.
    if (!navigator.serviceWorker.controller) {
        // The window client isn't currently controlled so it's a new service
        // worker that will activate immediately
        return;
    }

    // When the user asks to refresh the UI, we'll need to reload the window
    var preventDevToolsReloadLoop;
    navigator.serviceWorker.addEventListener("controllerchange", function(event) {
        // Ensure refresh is only called once.
        // This works around a bug in "force update on reload".
        if (preventDevToolsReloadLoop) {
            return;
        }
        preventDevToolsReloadLoop = true;
        window.location.reload();
    });

    onNewServiceWorker(registration, function() {
        showRefreshUI(registration, {
            message,
            onClick
        });
    }, {
        forceUpdate: forceUpdate
    });
}
