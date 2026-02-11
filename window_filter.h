// window_filter.h -- Per-window color filter via Magnifier control overlay
#pragma once
#include <napi.h>

Napi::Value CreateWindowFilter(const Napi::CallbackInfo& info);
Napi::Value SetFilterMatrix(const Napi::CallbackInfo& info);
Napi::Value ResetFilterMatrix(const Napi::CallbackInfo& info);
Napi::Value DestroyWindowFilter(const Napi::CallbackInfo& info);
Napi::Value DestroyAllFilters(const Napi::CallbackInfo& info);
Napi::Value ListFilters(const Napi::CallbackInfo& info);
Napi::Value SetPerWindowTargetFps(const Napi::CallbackInfo& info);
Napi::Value GetPerWindowTargetFps(const Napi::CallbackInfo& info);
