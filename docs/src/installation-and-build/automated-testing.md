---
order: 4
---

# Automated Testing

**Vutron** includes automated testing. The testing framework uses Microsoft's **[Playwright](https://playwright.dev)**.

**Playwright** is optimized for web application testing and has full support for the **Electron** framework. It is simple to install, requires no configuration to start testing immediately, and is cross-platform. You can learn more about **Playwright** here: https://github.com/microsoft/playwright

Only very simple launch and behavioral tests for the template main screen have been implemented in this template. Advanced testing will depend on the scope of your application.

Currently, the test specification file is located in the `tests` directory and the test results file is located in `tests/results`. (The built-in test specification file does not generate a separate results file.)

The Playwright configuration is `playwright.config.ts` in the project root, see the following documentation for more information on this: https://playwright.dev/docs/test-configuration

Once everything is configured, you can run a test with the following command.

```shell
$ npm run test
```

Before running the test, empty the build directory (`dist`) and compile the package for the test.
