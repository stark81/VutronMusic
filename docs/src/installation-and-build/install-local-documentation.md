---
order: 5
---

# Manage Local Documentation

Documents from `Vutron` can be viewed in the local environment through the `VitePress` viewer.

This function works only when the entire project is cloned. If you created the project with `npm init vutron`, the `docs` folder is not included.

## Installation

Everything in the instructions below should be done in the `docs` folder.

```shell
$ cd docs
```

Install the relevant packages using the following commands:

```shell
# via npm
$ npm i

# via yarn (https://yarnpkg.com)
$ yarn install

# via pnpm (https://pnpm.io)
$ pnpm i
```

You can run the local server where the documents are hosted via the command below.

```shell
$ npm run dev
```
