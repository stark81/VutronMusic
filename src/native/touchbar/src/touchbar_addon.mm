#import <napi.h>
#import "touchbar_view.h"

namespace {

static napi_env g_env = nullptr;

// ================ 线程安全回调数据 ================
struct TsfnData {
  NSInteger index;
  bool hasIndex;
};

// ================ call_js_cb ================
static void CallJsButton(napi_env env, napi_value jsCb, void* context, void* data) {
  if (!env || !jsCb) return;
  TsfnData* d = static_cast<TsfnData*>(data);
  napi_handle_scope scope;
  if (napi_open_handle_scope(env, &scope) != napi_ok) return;

  napi_value undefined;
  napi_get_undefined(env, &undefined);

  if (d && d->hasIndex) {
    napi_value arg;
    napi_create_double(env, (double)d->index, &arg);
    napi_call_function(env, undefined, jsCb, 1, &arg, nullptr);
  } else {
    napi_call_function(env, undefined, jsCb, 0, nullptr, nullptr);
  }

  napi_close_handle_scope(env, scope);
  delete d;
}

// ================ 辅助：创建 threadsafe function ================
static napi_threadsafe_function CreateTsfn(napi_env env, napi_value jsCb, const char* name, napi_threadsafe_function_call_js callback) {
  napi_threadsafe_function tsfn = nullptr;
  napi_value resourceName;
  napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &resourceName);
  napi_create_threadsafe_function(
      env, jsCb, nullptr, resourceName,
      0, 1, nullptr, nullptr, nullptr, callback, &tsfn);
  return tsfn;
}

// ================ TouchBarItem N-API 包装 ================
class TouchBarItem : public Napi::ObjectWrap<TouchBarItem> {
 public:
  static void Init(Napi::Env env, Napi::Object exports);
  TouchBarItem(const Napi::CallbackInfo& info);
  ~TouchBarItem();

  static Napi::FunctionReference constructor;

 private:
  TouchbarManager* manager_;
  napi_threadsafe_function buttonTsfn_ = nullptr;

  Napi::Value SetLyric(const Napi::CallbackInfo& info);
  Napi::Value SetPlaying(const Napi::CallbackInfo& info);
  Napi::Value SetPlaybackRate(const Napi::CallbackInfo& info);
  Napi::Value SetLikeState(const Napi::CallbackInfo& info);
  Napi::Value SetFMMode(const Napi::CallbackInfo& info);
  Napi::Value SetWordByWord(const Napi::CallbackInfo& info);
  Napi::Value SetPlayedColor(const Napi::CallbackInfo& info);
  Napi::Value SetPlayedColorLight(const Napi::CallbackInfo& info);
  Napi::Value OnButtonClick(const Napi::CallbackInfo& info);
  Napi::Value Install(const Napi::CallbackInfo& info);
  Napi::Value Destroy(const Napi::CallbackInfo& info);
};

Napi::FunctionReference TouchBarItem::constructor;

void TouchBarItem::Init(Napi::Env env, Napi::Object exports) {
  g_env = env;
  Napi::Function func = DefineClass(env, "TouchBarItem", {
    InstanceMethod("setLyric", &TouchBarItem::SetLyric),
    InstanceMethod("setPlaying", &TouchBarItem::SetPlaying),
    InstanceMethod("setPlaybackRate", &TouchBarItem::SetPlaybackRate),
    InstanceMethod("setLikeState", &TouchBarItem::SetLikeState),
    InstanceMethod("setFMMode", &TouchBarItem::SetFMMode),
    InstanceMethod("setWordByWord", &TouchBarItem::SetWordByWord),
    InstanceMethod("setPlayedColor", &TouchBarItem::SetPlayedColor),
    InstanceMethod("setPlayedColorLight", &TouchBarItem::SetPlayedColorLight),
    InstanceMethod("onButtonClick", &TouchBarItem::OnButtonClick),
    InstanceMethod("install", &TouchBarItem::Install),
    InstanceMethod("destroy", &TouchBarItem::Destroy),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports["createTouchBarItem"] = Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
    return constructor.New({});
  });
}

TouchBarItem::TouchBarItem(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<TouchBarItem>(info), manager_(nil) {
  g_env = info.Env();
  manager_ = [[TouchbarManager alloc] init];

  __block TouchBarItem* self = this;
  manager_.onButtonClick = ^(NSInteger index) {
    if (!self->buttonTsfn_) return;
    TsfnData* data = new TsfnData{index, true};
    napi_call_threadsafe_function(self->buttonTsfn_, data, napi_tsfn_blocking);
  };
}

TouchBarItem::~TouchBarItem() {
  if (manager_) {
    manager_ = nil;
  }
}

Napi::Value TouchBarItem::SetLyric(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 4) {
    Napi::TypeError::New(env, "Expected at least 4 arguments").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  NSString* text = [NSString stringWithUTF8String:info[0].As<Napi::String>().Utf8Value().c_str()];
  Napi::Array words = info[1].As<Napi::Array>();
  double lineStart = info[2].As<Napi::Number>().DoubleValue();
  double lineEnd = info[3].As<Napi::Number>().DoubleValue();
  bool hasTiming = info.Length() > 4 ? info[4].As<Napi::Boolean>().Value() : true;
  double lyricWidth = info.Length() > 5 ? info[5].As<Napi::Number>().DoubleValue() : 0;
  double offset = info.Length() > 6 ? info[6].As<Napi::Number>().DoubleValue() : 0;

  NSMutableArray* wordArray = [NSMutableArray arrayWithCapacity:words.Length()];
  for (uint32_t i = 0; i < words.Length(); i++) {
    Napi::Object w = words.Get(i).As<Napi::Object>();
    NSString* word = [NSString stringWithUTF8String:w.Get("word").As<Napi::String>().Utf8Value().c_str()];
    double start = w.Get("start").As<Napi::Number>().DoubleValue();
    double end = w.Get("end").As<Napi::Number>().DoubleValue();
    [wordArray addObject:@{@"word": word, @"start": @(start), @"end": @(end)}];
  }

  [manager_ updateLyricWithText:text words:wordArray lineStartMs:lineStart
                      lineEndMs:lineEnd hasWordTiming:hasTiming
                     lyricWidth:lyricWidth offset:offset];
  return env.Undefined();
}

Napi::Value TouchBarItem::SetPlaying(const Napi::CallbackInfo& info) {
  [manager_ setPlaying:info[0].As<Napi::Boolean>().Value()
              progress:info.Length() > 1 ? info[1].As<Napi::Number>().DoubleValue() : 0];
  return info.Env().Undefined();
}

Napi::Value TouchBarItem::SetPlaybackRate(const Napi::CallbackInfo& info) {
  [manager_ setPlaybackRate:info[0].As<Napi::Number>().DoubleValue()];
  return info.Env().Undefined();
}

Napi::Value TouchBarItem::SetLikeState(const Napi::CallbackInfo& info) {
  [manager_ setLikeState:info[0].As<Napi::Boolean>().Value()];
  return info.Env().Undefined();
}

Napi::Value TouchBarItem::SetFMMode(const Napi::CallbackInfo& info) {
  [manager_ setFMMode:info[0].As<Napi::Boolean>().Value()];
  return info.Env().Undefined();
}

Napi::Value TouchBarItem::SetWordByWord(const Napi::CallbackInfo& info) {
  [manager_ setWordByWord:info[0].As<Napi::Boolean>().Value()];
  return info.Env().Undefined();
}

Napi::Value TouchBarItem::SetPlayedColor(const Napi::CallbackInfo& info) {
  NSString* hex = [NSString stringWithUTF8String:info[0].As<Napi::String>().Utf8Value().c_str()];
  unsigned int r = 0, g = 0, b = 0;
  if (hex.length >= 7) {
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(1, 2)]] scanHexInt:&r];
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(3, 2)]] scanHexInt:&g];
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(5, 2)]] scanHexInt:&b];
    NSColor* color = [NSColor colorWithRed:r/255.0 green:g/255.0 blue:b/255.0 alpha:1.0];
    [manager_ setPlayedColor:color];
  }
  return info.Env().Undefined();
}

Napi::Value TouchBarItem::SetPlayedColorLight(const Napi::CallbackInfo& info) {
  NSString* hex = [NSString stringWithUTF8String:info[0].As<Napi::String>().Utf8Value().c_str()];
  unsigned int r = 0, g = 0, b = 0;
  if (hex.length >= 7) {
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(1, 2)]] scanHexInt:&r];
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(3, 2)]] scanHexInt:&g];
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(5, 2)]] scanHexInt:&b];
    NSColor* color = [NSColor colorWithRed:r/255.0 green:g/255.0 blue:b/255.0 alpha:1.0];
    [manager_ setPlayedColorLight:color];
  }
  return info.Env().Undefined();
}

Napi::Value TouchBarItem::OnButtonClick(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (buttonTsfn_) {
    napi_release_threadsafe_function(buttonTsfn_, napi_tsfn_release);
    buttonTsfn_ = nullptr;
  }
  buttonTsfn_ = CreateTsfn(env, info[0], "TouchBarButtonCb", CallJsButton);
  return env.Undefined();
}

Napi::Value TouchBarItem::Install(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() > 0 && info[0].IsBuffer()) {
    Napi::Buffer<char> buf = info[0].As<Napi::Buffer<char>>();
    if (buf.Length() >= sizeof(void*)) {
      void* ptr = nullptr;
      memcpy(&ptr, buf.Data(), sizeof(ptr));
      NSView* view = (__bridge NSView*)ptr;
      if (view) {
        [manager_ installOnWindowWithView:view];
        return env.Undefined();
      }
    }
  }
  [manager_ installOnWindow];
  return env.Undefined();
}

Napi::Value TouchBarItem::Destroy(const Napi::CallbackInfo& info) {
  if (buttonTsfn_) {
    napi_release_threadsafe_function(buttonTsfn_, napi_tsfn_release);
    buttonTsfn_ = nullptr;
  }
  if (manager_) {
    NSWindow* window = [NSApp keyWindow];
    if (window) {
      window.touchBar = nil;
    }
    manager_ = nil;
  }
  return info.Env().Undefined();
}

// ================ Module Init ================
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  g_env = env;
  TouchBarItem::Init(env, exports);
  return exports;
}

} // namespace

NODE_API_MODULE(touchbar_addon, Init)
