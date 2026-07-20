{
  "targets": [
    {
      "target_name": "smtc_addon",
      "conditions": [
        ["OS=='win'", {
          "sources": ["src/smtc_addon.cpp"],
          "include_dirs": [
            "../../../node_modules/node-addon-api"
          ],
          "libraries": [
            "-lruntimeobject.lib"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": [
                "/std:c++17",
                "/ZW",
                "/EHsc"
              ]
            }
          }
        }]
      ]
    }
  ]
}
