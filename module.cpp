#include <napi.h>

// macOS does not expose a public API for global screen color-matrix transforms.
// Keep the Windows addon interface, but return false for all calls as a safe no-op.
namespace {

Napi::Value Init(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), false);
}

Napi::Value ApplyMatrix(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), false);
}

Napi::Value Reset(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), false);
}

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  exports.Set("init", Napi::Function::New(env, Init));
  exports.Set("applyMatrix", Napi::Function::New(env, ApplyMatrix));
  exports.Set("reset", Napi::Function::New(env, Reset));
  return exports;
}

}  // namespace

NODE_API_MODULE(module, InitModule)
