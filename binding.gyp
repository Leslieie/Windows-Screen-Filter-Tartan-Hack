{
  "targets": [
    {
      "target_name": "screen_color_transform",
      "sources": [
        "src/module.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include_dir\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET": "12.0"
      }
    }
  ]
}
