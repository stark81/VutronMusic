// Windows SMTC native addon
// 使用 C++/WinRT 调用 SystemMediaTransportControls
//
// 注意：需要在 Windows 10+ 上编译，需要 Windows SDK 10.0.17763.0+
//
// 编译依赖：
//   - node-addon-api
//   - Windows SDK (runtimeobject.lib)
//   - C++/WinRT (通过 /ZW 编译器选项启用)

#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <napi.h>
#include <windows.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Media.h>
#include <winrt/Windows.Storage.Streams.h>

using namespace winrt;
using namespace winrt::Windows::Foundation;
using namespace winrt::Windows::Media;
using namespace winrt::Windows::Storage::Streams;

// ================ 线程安全回调 ================
struct CommandData {
  char* command;
};

static void CallJsCommand(napi_env env, napi_value jsCb, void* context, void* data) {
  if (!env || !jsCb) return;
  CommandData* d = static_cast<CommandData*>(data);
  napi_handle_scope scope;
  if (napi_open_handle_scope(env, &scope) != napi_ok) return;

  napi_value undefined;
  napi_get_undefined(env, &undefined);

  if (d && d->command) {
    napi_value cmd;
    napi_create_string_utf8(env, d->command, NAPI_AUTO_LENGTH, &cmd);
    napi_call_function(env, undefined, jsCb, 1, &cmd, nullptr);
    delete[] d->command;
  }

  napi_close_handle_scope(env, scope);
  delete d;
}

static napi_threadsafe_function CreateTsfn(napi_env env, napi_value jsCb) {
  napi_threadsafe_function tsfn = nullptr;
  napi_value name;
  napi_create_string_utf8(env, "SMTCButtonCb", NAPI_AUTO_LENGTH, &name);
  napi_create_threadsafe_function(env, jsCb, nullptr, name, 0, 1, nullptr, nullptr, nullptr, CallJsCommand, &tsfn);
  return tsfn;
}

// ================ SMTCSession N-API 包装 ================
class SMTCSession : public Napi::ObjectWrap<SMTCSession> {
 public:
  static void Init(Napi::Env env, Napi::Object exports);
  SMTCSession(const Napi::CallbackInfo& info);
  ~SMTCSession();

 private:
  SystemMediaTransportControls smtc_{nullptr};
  SystemMediaTransportControlsDisplayUpdater updater_{nullptr};
  winrt::event_token playToken_, pauseToken_, nextToken_, prevToken_;
  napi_threadsafe_function buttonTsfn_ = nullptr;
  bool registered_ = false;

  Napi::Value SetMetadata(const Napi::CallbackInfo& info);
  Napi::Value SetPlaybackState(const Napi::CallbackInfo& info);
  Napi::Value ClearMetadata(const Napi::CallbackInfo& info);
  Napi::Value OnButtonClick(const Napi::CallbackInfo& info);
  Napi::Value Destroy(const Napi::CallbackInfo& info);

  void SendCommand(const char* cmd);
};

Napi::FunctionReference SMTCSession::constructor;

void SMTCSession::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "SMTCSession", {
    InstanceMethod("setMetadata", &SMTCSession::SetMetadata),
    InstanceMethod("setPlaybackState", &SMTCSession::SetPlaybackState),
    InstanceMethod("clearMetadata", &SMTCSession::ClearMetadata),
    InstanceMethod("onButtonClick", &SMTCSession::OnButtonClick),
    InstanceMethod("destroy", &SMTCSession::Destroy),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports["createSMTCSession"] = Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
    return constructor.New({});
  });
}

SMTCSession::SMTCSession(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<SMTCSession>(info) {
  try {
    winrt::init_apartment(winrt::apartment_type::single_threaded);

    smtc_ = SystemMediaTransportControls::GetForCurrentView();
    smtc_.IsEnabled(true);
    smtc_.IsPlayEnabled(true);
    smtc_.IsPauseEnabled(true);
    smtc_.IsNextEnabled(true);
    smtc_.IsPreviousEnabled(true);

    updater_ = smtc_.DisplayUpdater();
    updater_.Type(MediaPlaybackType::Music);
    updater_.MusicProperties().Title(L"");
    updater_.Update();

    registered_ = true;

    auto weak = this;
    playToken_ = smtc_.ButtonPressed([weak](const SystemMediaTransportControls&, const SystemMediaTransportControlsButtonPressedEventArgs& args) {
      if (!weak) return;
      switch (args.Button()) {
        case SystemMediaTransportControlsButton::Play:
          weak->SendCommand("play");
          break;
        case SystemMediaTransportControlsButton::Pause:
          weak->SendCommand("pause");
          break;
        case SystemMediaTransportControlsButton::Next:
          weak->SendCommand("next");
          break;
        case SystemMediaTransportControlsButton::Previous:
          weak->SendCommand("previous");
          break;
        case SystemMediaTransportControlsButton::Stop:
          weak->SendCommand("pause");
          break;
      }
    });

  } catch (const winrt::hresult_error& e) {
    std::cerr << "[SMTC] init error: " << winrt::to_string(e.message()) << std::endl;
  }
}

SMTCSession::~SMTCSession() {
  Destroy(Napi::CallbackInfo(Napi::Env(), Napi::Value()));
}

void SMTCSession::SendCommand(const char* cmd) {
  if (!buttonTsfn_) return;
  CommandData* data = new CommandData{};
  size_t len = strlen(cmd);
  data->command = new char[len + 1];
  strcpy_s(data->command, len + 1, cmd);
  napi_call_threadsafe_function(buttonTsfn_, data, napi_tsfn_nonblocking);
}

Napi::Value SMTCSession::SetMetadata(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!updater_) return env.Undefined();

  try {
    auto music = updater_.MusicProperties();

    if (info[0].IsObject()) {
      Napi::Object meta = info[0].As<Napi::Object>();

      if (meta.Has("title")) {
        std::string title = meta.Get("title").As<Napi::String>().Utf8Value();
        music.Title(winrt::to_hstring(title));
      }
      if (meta.Has("artist")) {
        std::string artist = meta.Get("artist").As<Napi::String>().Utf8Value();
        music.Artist(winrt::to_hstring(artist));
      }
      if (meta.Has("album")) {
        std::string album = meta.Get("album").As<Napi::String>().Utf8Value();
        music.AlbumTitle(winrt::to_hstring(album));
      }
      if (meta.Has("duration")) {
        double dur = meta.Get("duration").As<Napi::Number>().DoubleValue();
        smtc_.PlaybackPositionChangeRequested(dur);
      }

      updater_.Update();
    }
  } catch (const winrt::hresult_error& e) {
    std::cerr << "[SMTC] setMetadata error: " << winrt::to_string(e.message()) << std::endl;
  }

  return env.Undefined();
}

Napi::Value SMTCSession::SetPlaybackState(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!smtc_) return env.Undefined();

  try {
    bool playing = info[0].IsBoolean() && info[0].As<Napi::Boolean>().Value();
    smtc_.PlaybackStatus(playing
      ? MediaPlaybackStatus::Playing
      : MediaPlaybackStatus::Paused);
  } catch (const winrt::hresult_error& e) {
    std::cerr << "[SMTC] setPlaybackState error: " << winrt::to_string(e.message()) << std::endl;
  }

  return env.Undefined();
}

Napi::Value SMTCSession::ClearMetadata(const Napi::CallbackInfo& info) {
  if (updater_) {
    try {
      updater_.ClearAll();
      updater_.Update();
    } catch (...) {}
  }
  return info.Env().Undefined();
}

Napi::Value SMTCSession::OnButtonClick(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (buttonTsfn_) {
    napi_release_threadsafe_function(buttonTsfn_, napi_tsfn_release);
    buttonTsfn_ = nullptr;
  }
  buttonTsfn_ = CreateTsfn(env, info[0]);
  return env.Undefined();
}

Napi::Value SMTCSession::Destroy(const Napi::CallbackInfo& info) {
  if (buttonTsfn_) {
    napi_release_threadsafe_function(buttonTsfn_, napi_tsfn_release);
    buttonTsfn_ = nullptr;
  }

  if (smtc_ && registered_) {
    try {
      smtc_.ButtonPressed(playToken_);
      smtc_.IsEnabled(false);
    } catch (...) {}
    smtc_ = nullptr;
    registered_ = false;
  }

  return info.Env().Undefined();
}

// ================ Module Init ================
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  SMTCSession::Init(env, exports);
  return exports;
}

NODE_API_MODULE(smtc_addon, Init)

#endif // _WIN32
