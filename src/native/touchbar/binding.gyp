{
  "targets": [
    {
      "target_name": "touchbar_addon",
      "cflags_cc+": ["-std=c++17", "-ObjC++", "-fexceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "OTHER_CFLAGS": ["-ObjC++"],
        "OTHER_LDFLAGS": ["-framework Cocoa", "-framework AppKit"]
      },
      "conditions": [
        ["OS=='mac'", {
          "sources": [
            "src/touchbar_addon.mm",
            "src/touchbar_view.mm"
          ],
          "include_dirs": [
            "../../../node_modules/node-addon-api",
            "src"
          ]
        }]
      ]
    }
  ]
}
