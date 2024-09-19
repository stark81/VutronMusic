# Preload Script

The preload script in Electron.js is a secure area designed for communication between the main and renderer processes. It is typically used for **[IPC communication](https://www.electronjs.org/docs/latest/tutorial/ipc)**.

For more information, see the following articles https://www.electronjs.org/docs/latest/tutorial/tutorial-preload

For compatibility and security with the latest version of Electron, we do not recommend using the old `electron/remote` module. If you want to utilize system events or Node scripts, it is recommended to do so in the main process, not the renderer.

Vutron's preload script is located in the `src/preload` folder. To create a new IPC communication channel, add the channel name to the following variable to whitelist it for communication.

- `mainAvailChannels`: Send an event from main to renderer. (`window.mainApi.send('channelName')`)
- `rendererAvailChannels`: Send an event from renderer to main. (`mainWindow.webContents.send('channelName')`)

When sending events from renderer to main, you access the `window.mainApi` object instead of `ipcRenderer.send`. The `mainApi` is the name you set in your Vutron template and can be changed.

Here are the supported functions for mainApi:

- `send`: Send an event to main.
- `on`: A listener to receive events sent by main.
- `once`: A listener to receive events sent by main. (Handle only one call)
- `off`: Remove an event listener
- `invoke`: Functions that can send events to main and receive data asynchronously.

To change and modify this, you need to modify `exposeInMainWorld` in `src/preload/index.ts`.
