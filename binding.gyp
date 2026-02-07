{
  "targets": [
    {
      "target_name": "screentint_native",
      "sources": ["module.cpp"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS", "UNICODE", "_UNICODE"],
      "conditions": [
        [
          "OS=='win'",
          {
            "libraries": ["-lmagnification.lib"]
          }
        ]
      ]
    }
  ]
}