// module.cpp — Windows Magnification API native addon
//
// This applies a 5×5 color transformation matrix to the ENTIRE screen
// at the GPU/DWM compositor level. Zero CPU cost, zero lag.
//
// Key API: MagSetFullscreenColorEffect() — Windows 8+
// The matrix is applied by the Desktop Window Manager before pixels
// hit the display. No screenshots, no canvas, no overhead.
//
// Build: node-gyp rebuild  (or electron-rebuild)

#include <napi.h>

#ifdef _WIN32
// ── Windows: Real Magnification API ──────────────────────────────
#include <windows.h>
#include <magnification.h>
#pragma comment(lib, "magnification.lib")

static bool g_initialized = false;

Napi::Value Init(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_initialized) return Napi::Boolean::New(env, true);

  BOOL ok = MagInitialize();
  g_initialized = (ok == TRUE);

  if (!g_initialized) {
    Napi::Error::New(env, "MagInitialize() failed. Run as admin or check Windows version (8+).")
      .ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }
  return Napi::Boolean::New(env, true);
}

// applyMatrix(Float64Array[25]) — apply a 5×5 color matrix to full screen
//
// Input: 25 floats in ROW-VECTOR convention (already transposed by vision-api.js)
// The Magnification API expects: [row0..., row1..., row2..., row3..., row4...]
// where output = input_vector × matrix
Napi::Value ApplyMatrix(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!g_initialized) {
    Napi::Error::New(env, "Not initialized. Call init() first.")
      .ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  if (info.Length() < 1 || !info[0].IsArray()) {
    Napi::TypeError::New(env, "Expected array of 25 numbers")
      .ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  Napi::Array arr = info[0].As<Napi::Array>();
  if (arr.Length() != 25) {
    Napi::TypeError::New(env, "Matrix must have exactly 25 elements")
      .ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  // Fill the MAGCOLOREFFECT structure
  // MAGCOLOREFFECT.transform is a float[5][5]
  MAGCOLOREFFECT effect;
  for (uint32_t i = 0; i < 25; i++) {
    Napi::Value val = arr[i];
    effect.transform[i / 5][i % 5] = static_cast<float>(val.As<Napi::Number>().DoubleValue());
  }

  BOOL ok = MagSetFullscreenColorEffect(&effect);
  return Napi::Boolean::New(env, ok == TRUE);
}

// Reset to identity (remove all effects)
Napi::Value Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!g_initialized) return Napi::Boolean::New(env, false);

  // Identity matrix
  MAGCOLOREFFECT identity;
  memset(&identity, 0, sizeof(identity));
  identity.transform[0][0] = 1.0f;
  identity.transform[1][1] = 1.0f;
  identity.transform[2][2] = 1.0f;
  identity.transform[3][3] = 1.0f;
  identity.transform[4][4] = 1.0f;

  BOOL ok = MagSetFullscreenColorEffect(&identity);
  return Napi::Boolean::New(env, ok == TRUE);
}

Napi::Value Shutdown(const Napi::CallbackInfo& info) {
  if (g_initialized) {
    // Reset before shutdown
    MAGCOLOREFFECT identity;
    memset(&identity, 0, sizeof(identity));
    identity.transform[0][0] = 1.0f;
    identity.transform[1][1] = 1.0f;
    identity.transform[2][2] = 1.0f;
    identity.transform[3][3] = 1.0f;
    identity.transform[4][4] = 1.0f;
    MagSetFullscreenColorEffect(&identity);

    MagUninitialize();
    g_initialized = false;
  }
  return Napi::Boolean::New(info.Env(), true);
}

Napi::Value IsAvailable(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), true);
}

#else
// ── macOS / Linux: No-op stubs ──────────────────────────────────

Napi::Value Init(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), false);
}
Napi::Value ApplyMatrix(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), false);
}
Napi::Value Reset(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), false);
}
Napi::Value Shutdown(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), true);
}
Napi::Value IsAvailable(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), false);
}

#endif

// ── Module registration ─────────────────────────────────────────

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  exports.Set("init",        Napi::Function::New(env, Init));
  exports.Set("applyMatrix", Napi::Function::New(env, ApplyMatrix));
  exports.Set("reset",       Napi::Function::New(env, Reset));
  exports.Set("shutdown",    Napi::Function::New(env, Shutdown));
  exports.Set("isAvailable", Napi::Function::New(env, IsAvailable));
  return exports;
}

NODE_API_MODULE(screentint_native, InitModule)
