// Warning: This file is only used in the development environment
// and is removed at build time.
// Do not edit the file unless necessary.
import { installExtension, VUEJS_DEVTOOLS } from 'electron-extension-installer'

installExtension(VUEJS_DEVTOOLS, {
  loadExtensionOptions: {
    allowFileAccess: true
  }
})
