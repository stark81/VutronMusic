{
  "targets": [
    {
      "target_name": "tray_addon",
      "cflags_cc+": ["-std=c++17", "-ObjC++", "-fexceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "OTHER_CFLAGS": ["-ObjC++"],
        "OTHER_LDFLAGS": ["-framework Cocoa", "-framework AppKit"],
        "ASSETCATALOG_COMPILER_APPICON_NAME": "",
        "INFOPLIST_FILE": ""
      },
      "conditions": [
        ["OS=='mac'", {
          "sources": [
            "src/tray_addon.mm",
            "src/tray_view.mm"
          ],
          "include_dirs": [
            "../../../node_modules/node-addon-api",
            "src"
          ],
          "copies": []
        }]
      ]
    }
  ]
}
