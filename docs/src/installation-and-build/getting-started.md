---
order: 1
---

# Getting Started

## Clone project

### Method 1: `npm init` (Recommend)

You can easily clone a repository with just the npm command.

```shell
$ npm init vutron
```

The above method will not create unnecessary documentation and `.github` related files for your project.

### Method 2: Use this template

Click **[Use this template](https://github.com/jooy2/vutron/generate)** to instantly create your own project.

This method creates a repository on GitHub immediately, but you will need to clone the project locally before you can use it.

### Method 3: Clone this repository

Clone this repo using below command. This method is suitable for direct contributions to the Vutron repository.

```shell
$ git clone https://github.com/jooy2/vutron <PROJECT_NAME>
```

## Installation

After cloning the project, run the following command in the terminal:

```shell
# via npm
$ npm i

# via yarn (https://yarnpkg.com)
$ yarn install

# via pnpm (https://pnpm.io)
$ pnpm i
```

## Run in development environment

Applications in the development environment run through **[Vite](https://vitejs.dev)**.

```shell
$ npm run dev
```

If your application doesn't appear after running command line commands, you may need to review if the default port is being used by another app.

Vite uses port `5173` by default.
