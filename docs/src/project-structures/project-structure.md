---
order: 1
---

# Project Structure

```
/
├─ .github - GitHub files (only used for Vutron GitHub project contributions)
│  └─ ISSUE_TEMPLATE/
│  └─ resources/ - GitHub resources used for README.md, etc.
│  └─ workflows/ - GitHub workflows definition
│  └─ dependabot.yml
│  └─ FUNDING.yml
├─ .vscode - Common project configuration files used by Visual Studio Code IDE
├─ buildAssets/ - Package resource (icon, logo, etc.) file used for Electron build
│  └─ builder/
│  │  │  └─ config.ts - `electron-builder` dynamic configuration file
│  └─ icons/
├─ dist/ - Output directory used to build the package
├─ docs/ - Project documents (optionally enabled)
│  └─ .vitepress/
│  │  │  └─ config.mts - VitePress configuration file used for document hosting
│  └─ public/ - Root resource directory for VitePress documentation pages
├─ node_modules/
├─ src/
│  ├─ main/ - Main (Electron) process source code
│  │  ├─ utils/ - Main process utilities
│  │  │  └─ Constants.ts - Main global definition
│  │  │  └─ Menus.ts - Main global menu definition
│  │  └─ index.ts - Main process entry point
│  │  └─ IPCs.ts - Main process ipc handlers definition
│  │  └─ MainRunner.ts - Main process main window processing
│  ├─ preload/ - Preload (Electron-Vue communication bridge) process source code
│  │  └─ index.ts
│  ├─ renderer/ - Renderer (Vue) process source code
│  │  ├─ components/ - Vue components collection
│  │  │  └─ layout/ - Layout components
│  │  ├─ locales/ - Vue i18n language resource file
│  │  ├─ plugins/ - Vue plugin definition
│  │  ├─ public/ - Vue static resources
│  │  │  └─ images/
│  │  ├─ router/ - Vue routing definition
│  │  ├─ screens/ - Vue screen component
│  │  │  └─ ErrorScreen.vue - Screen displayed when renderer process and routing errors occur
│  │  │  └─ MainScreen.vue
│  │  │  └─ SecondScreen.vue - Sample screen
│  │  ├─ store/ - Pinia store (Global state management) definition
│  │  ├─ utils/ - Renderer process utilities
│  │  ├─ App.vue - Vue app's root component
│  │  ├─ index.html - Root static index loaded by Electron renderer process
│  └─ └─ main.ts - Renderer process entry point
├─ tests/ - Application test configuration
│  └─ app.spec.ts - Test file specification
├─ .editorconfig - Editor recommended configuration file for IDE
├─ .eslintignore - List of files to be ignored by ESLint
├─ .eslintrc.json - ESLint rule configurations
├─ .gitignore - List of files to not upload to Git
├─ .prettierignore - List of files to disable Prettier file formatting
├─ .prettierrc - Prettier rule configurations
├─ CODE_OF_CONDUCT.md - Files used only on GitHub
├─ LICENSE - Project license file
├─ package.json - NodeJS package configurations
├─ package-lock.json
├─ playwright.config.ts - Playwright test rules configurations
├─ tsconfig.json - TypeScript configurations
├─ tsconfig.node.json - TypeScript configurations
├─ vite.config.mts - Vite compiler build configurations
└─ README.md - Files used only on GitHub
```
