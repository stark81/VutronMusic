#import <napi.h>
#import "tray_view.h"

static napi_env g_env = nullptr;

namespace {

// ================ 线程安全回调数据 ================
struct TsfnData {
  NSInteger index;
  bool hasIndex;
};

// ================ TrayItem 包装 ================
class TrayItem : public Napi::ObjectWrap<TrayItem> {
 public:
  static void Init(Napi::Env env, Napi::Object exports);
  TrayItem(const Napi::CallbackInfo& info);
  ~TrayItem();

  static Napi::FunctionReference constructor;

 private:
  NativeTrayView* view_;

  napi_threadsafe_function buttonTsfn_ = nullptr;
  napi_threadsafe_function rightTsfn_ = nullptr;
  napi_threadsafe_function trayTsfn_ = nullptr;
  napi_threadsafe_function menuCbTsfn_ = nullptr;  // 原生菜单项点击回调

  Napi::Value SetLyric(const Napi::CallbackInfo& info);
  Napi::Value SetPlaying(const Napi::CallbackInfo& info);
  Napi::Value SetProgress(const Napi::CallbackInfo& info);
  Napi::Value SetPlaybackRate(const Napi::CallbackInfo& info);
  Napi::Value SetLikeState(const Napi::CallbackInfo& info);
  Napi::Value SetWidth(const Napi::CallbackInfo& info);
  Napi::Value SetButtonType(const Napi::CallbackInfo& info);
  Napi::Value SetIconImage(const Napi::CallbackInfo& info);
  Napi::Value SetVisibility(const Napi::CallbackInfo& info);
  Napi::Value SetWordByWord(const Napi::CallbackInfo& info);
  Napi::Value SetPlayedColor(const Napi::CallbackInfo& info);
  Napi::Value SetPlayedColorLight(const Napi::CallbackInfo& info);
  Napi::Value OnButtonClick(const Napi::CallbackInfo& info);
  Napi::Value OnRightClick(const Napi::CallbackInfo& info);
  Napi::Value OnTrayClick(const Napi::CallbackInfo& info);
  Napi::Value Destroy(const Napi::CallbackInfo& info);
  Napi::Value GetClickPosition(const Napi::CallbackInfo& info);
  Napi::Value PopupNativeMenu(const Napi::CallbackInfo& info);
};

// ================ call_js_cb: Node.js 线程上执行 JS 的回调 ================
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

static void CallJsNoArg(napi_env env, napi_value jsCb, void* context, void* data) {
  if (!env || !jsCb) return;
  napi_handle_scope scope;
  if (napi_open_handle_scope(env, &scope) != napi_ok) return;
  napi_value undefined;
  napi_get_undefined(env, &undefined);
  napi_call_function(env, undefined, jsCb, 0, nullptr, nullptr);
  napi_close_handle_scope(env, scope);
}

// ================ 辅助：创建 threadsafe function ================
static napi_threadsafe_function CreateTsfn(napi_env env, napi_value jsCb, const char* name, napi_threadsafe_function_call_js callback) {
  napi_threadsafe_function tsfn = nullptr;
  napi_value resourceName;
  napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &resourceName);
  napi_create_threadsafe_function(
      env,
      jsCb,
      nullptr,          // async_resource
      resourceName,
      0,                // max_queue_size (0 = unlimited)
      1,                // initial_thread_count
      nullptr,          // thread_finalize_data
      nullptr,          // thread_finalize_cb
      nullptr,          // context
      callback,
      &tsfn);
  return tsfn;
}

void TrayItem::Init(Napi::Env env, Napi::Object exports) {
  g_env = env;
  Napi::Function func = DefineClass(env, "TrayItem", {
    InstanceMethod("setLyric", &TrayItem::SetLyric),
    InstanceMethod("setPlaying", &TrayItem::SetPlaying),
    InstanceMethod("setProgress", &TrayItem::SetProgress),
    InstanceMethod("setPlaybackRate", &TrayItem::SetPlaybackRate),
    InstanceMethod("setLikeState", &TrayItem::SetLikeState),
    InstanceMethod("setWidth", &TrayItem::SetWidth),
    InstanceMethod("setButtonType", &TrayItem::SetButtonType),
    InstanceMethod("setIconImage", &TrayItem::SetIconImage),
    InstanceMethod("setVisibility", &TrayItem::SetVisibility),
    InstanceMethod("setWordByWord", &TrayItem::SetWordByWord),
    InstanceMethod("setPlayedColor", &TrayItem::SetPlayedColor),
    InstanceMethod("setPlayedColorLight", &TrayItem::SetPlayedColorLight),
    InstanceMethod("onButtonClick", &TrayItem::OnButtonClick),
    InstanceMethod("onRightClick", &TrayItem::OnRightClick),
    InstanceMethod("onTrayClick", &TrayItem::OnTrayClick),
    InstanceMethod("destroy", &TrayItem::Destroy),
    InstanceMethod("getClickPosition", &TrayItem::GetClickPosition),
    InstanceMethod("popupNativeMenu", &TrayItem::PopupNativeMenu),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports["createTrayItem"] = Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
    return constructor.New({});
  });
}

TrayItem::TrayItem(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<TrayItem>(info), view_(nil) {
  g_env = info.Env();

  NSStatusItem* item = [[NSStatusBar systemStatusBar] statusItemWithLength:NSSquareStatusItemLength];
  NativeTrayView* view = [[NativeTrayView alloc] initWithStatusItem:item
                                                           iconSize:14
                                                     lyricAreaWidth:180
                                                        buttonWidth:16];
  item.button.wantsLayer = YES;
  [item.button addSubview:view];
  view_ = view;

  __block TrayItem* self = this;

  view.onButtonClick = ^(NSInteger index) {
    if (!self->buttonTsfn_) return;
    TsfnData* data = new TsfnData{index, true};
    napi_call_threadsafe_function(self->buttonTsfn_, data, napi_tsfn_blocking);
  };

  view.onRightClick = ^{
    if (!self->rightTsfn_) return;
    napi_call_threadsafe_function(self->rightTsfn_, nullptr, napi_tsfn_blocking);
  };

  view.onTrayClick = ^{
    if (!self->trayTsfn_) return;
    napi_call_threadsafe_function(self->trayTsfn_, nullptr, napi_tsfn_blocking);
  };
}

TrayItem::~TrayItem() {
  if (view_) {
    [view_ removeFromSuperview];
    view_ = nil;
  }
}

Napi::FunctionReference TrayItem::constructor;

// ================ 接口实现 ================
Napi::Value TrayItem::SetLyric(const Napi::CallbackInfo& info) {
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

  [view_ updateLyricWithText:text words:wordArray lineStartMs:lineStart
                    lineEndMs:lineEnd hasWordTiming:hasTiming
                   lyricWidth:lyricWidth offset:offset];
  return env.Undefined();
}

Napi::Value TrayItem::SetPlaying(const Napi::CallbackInfo& info) {
  [view_ setPlaying:info[0].As<Napi::Boolean>().Value()];
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetProgress(const Napi::CallbackInfo& info) {
  [view_ setProgress:info[0].As<Napi::Number>().DoubleValue()];
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetPlaybackRate(const Napi::CallbackInfo& info) {
  [view_ setPlaybackRate:info[0].As<Napi::Number>().DoubleValue()];
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetLikeState(const Napi::CallbackInfo& info) {
  [view_ setLikeState:info[0].As<Napi::Boolean>().Value()];
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetWidth(const Napi::CallbackInfo& info) {
  [view_ setWidth:(CGFloat)info[0].As<Napi::Number>().DoubleValue()];
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetButtonType(const Napi::CallbackInfo& info) {
  [view_ setButtonType:(NSInteger)info[0].As<Napi::Number>().Int32Value()
                  type:(NSInteger)info[1].As<Napi::Number>().Int32Value()];
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetIconImage(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info[0].IsBuffer()) {
    Napi::Buffer<char> buf = info[0].As<Napi::Buffer<char>>();
    NSData* data = [NSData dataWithBytes:buf.Data() length:buf.Length()];
    [view_ setIconImage:[[NSImage alloc] initWithData:data]];
  }
  return env.Undefined();
}

Napi::Value TrayItem::SetVisibility(const Napi::CallbackInfo& info) {
  Napi::Object opts = info[0].As<Napi::Object>();
  if (opts.Has("lyric"))
    [view_ setLyricVisibility:opts.Get("lyric").As<Napi::Boolean>().Value()];
  if (opts.Has("buttons"))
    [view_ setButtonVisibility:opts.Get("buttons").As<Napi::Boolean>().Value()];
  if (opts.Has("icon"))
    [view_ setIconVisibility:opts.Get("icon").As<Napi::Boolean>().Value()];
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetWordByWord(const Napi::CallbackInfo& info) {
  [view_ setWordByWord:info[0].As<Napi::Boolean>().Value()];
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetPlayedColor(const Napi::CallbackInfo& info) {
  NSString* hex = [NSString stringWithUTF8String:info[0].As<Napi::String>().Utf8Value().c_str()];
  // 将 hex 字符串 (#RRGGBB) 转换为 NSColor
  unsigned int r = 0, g = 0, b = 0;
  if (hex.length >= 7) {
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(1, 2)]] scanHexInt:&r];
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(3, 2)]] scanHexInt:&g];
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(5, 2)]] scanHexInt:&b];
    NSColor* color = [NSColor colorWithRed:r/255.0 green:g/255.0 blue:b/255.0 alpha:1.0];
    [view_ setPlayedColor:color];
  }
  return info.Env().Undefined();
}

Napi::Value TrayItem::SetPlayedColorLight(const Napi::CallbackInfo& info) {
  NSString* hex = [NSString stringWithUTF8String:info[0].As<Napi::String>().Utf8Value().c_str()];
  unsigned int r = 0, g = 0, b = 0;
  if (hex.length >= 7) {
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(1, 2)]] scanHexInt:&r];
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(3, 2)]] scanHexInt:&g];
    [[NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(5, 2)]] scanHexInt:&b];
    NSColor* color = [NSColor colorWithRed:r/255.0 green:g/255.0 blue:b/255.0 alpha:1.0];
    [view_ setPlayedColorLight:color];
  }
  return info.Env().Undefined();
}

Napi::Value TrayItem::OnButtonClick(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (buttonTsfn_) {
    napi_release_threadsafe_function(buttonTsfn_, napi_tsfn_release);
    buttonTsfn_ = nullptr;
  }
  buttonTsfn_ = CreateTsfn(env, info[0], "ButtonCb", CallJsButton);
  return env.Undefined();
}

Napi::Value TrayItem::OnRightClick(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (rightTsfn_) {
    napi_release_threadsafe_function(rightTsfn_, napi_tsfn_release);
    rightTsfn_ = nullptr;
  }
  rightTsfn_ = CreateTsfn(env, info[0], "RightClickCb", CallJsNoArg);
  return env.Undefined();
}

Napi::Value TrayItem::OnTrayClick(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (trayTsfn_) {
    napi_release_threadsafe_function(trayTsfn_, napi_tsfn_release);
    trayTsfn_ = nullptr;
  }
  trayTsfn_ = CreateTsfn(env, info[0], "TrayClickCb", CallJsNoArg);
  return env.Undefined();
}

static void CallJsMenu(napi_env env, napi_value jsCb, void* context, void* data) {
  if (!env || !jsCb) return;
  TsfnData* d = static_cast<TsfnData*>(data);
  if (!d) return;
  napi_handle_scope scope;
  if (napi_open_handle_scope(env, &scope) != napi_ok) return;
  napi_value undefined;
  napi_get_undefined(env, &undefined);
  napi_value arg;
  napi_create_double(env, (double)d->index, &arg);
  napi_call_function(env, undefined, jsCb, 1, &arg, nullptr);
  napi_close_handle_scope(env, scope);
  delete d;
}

// 辅助：从 Napi::Array 递归构建 NSMenu
static NSMenu* BuildNSMenu(Napi::Array items, NativeTrayView* view) {
  NSMenu* menu = [[NSMenu alloc] init];
  for (uint32_t i = 0; i < items.Length(); i++) {
    Napi::Value val = items.Get(i);
    if (!val.IsObject()) continue;
    Napi::Object item = val.As<Napi::Object>();

    std::string type = item.Has("type") ? item.Get("type").As<Napi::String>().Utf8Value() : "normal";

    if (type == "separator") {
      [menu addItem:[NSMenuItem separatorItem]];
      continue;
    }

    std::string label = item.Get("label").As<Napi::String>().Utf8Value();
    NSMenuItem* menuItem = [[NSMenuItem alloc] initWithTitle:[NSString stringWithUTF8String:label.c_str()]
                                                      action:@selector(menuItemClicked:)
                                               keyEquivalent:@""];
    menuItem.target = view;

    if (item.Has("id")) {
      menuItem.tag = item.Get("id").As<Napi::Number>().Int32Value();
    } else {
      menuItem.tag = i;
    }

    if (item.Has("enabled") && !item.Get("enabled").As<Napi::Boolean>().Value()) {
      menuItem.enabled = NO;
    }

    if (type == "checkbox" || type == "radio") {
      bool checked = item.Has("checked") && item.Get("checked").As<Napi::Boolean>().Value();
      menuItem.state = checked ? NSControlStateValueOn : NSControlStateValueOff;
    }

    // 子菜单
    if (item.Has("submenu") && item.Get("submenu").IsArray()) {
      NSMenu* submenu = BuildNSMenu(item.Get("submenu").As<Napi::Array>(), view);
      [menu setSubmenu:submenu forItem:menuItem];
    }

    [menu addItem:menuItem];
  }
  return menu;
}

Napi::Value TrayItem::GetClickPosition(const Napi::CallbackInfo& info) {
  Napi::Object obj = Napi::Object::New(info.Env());
  obj.Set("x", view_.lastClickScreenPoint.x);
  obj.Set("y", view_.lastClickScreenPoint.y);
  return obj;
}

Napi::Value TrayItem::PopupNativeMenu(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsArray() || !info[1].IsFunction()) {
    Napi::TypeError::New(env, "Expected items array and callback function").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // 释放旧 callback
  if (menuCbTsfn_) {
    napi_release_threadsafe_function(menuCbTsfn_, napi_tsfn_release);
    menuCbTsfn_ = nullptr;
  }

  Napi::Array items = info[0].As<Napi::Array>();
  menuCbTsfn_ = CreateTsfn(env, info[1].As<Napi::Function>(), "MenuCb", CallJsMenu);

  // 构建 NSMenu（当前线程，可能为 Node.js 线程）
  NSMenu* menu = BuildNSMenu(items, view_);

  // 设置 menu callback bridge
  __block TrayItem* self = this;
  view_.onMenuItemClicked = ^(NSInteger tag) {
    if (!self->menuCbTsfn_) return;
    TsfnData* data = new TsfnData{tag, true};
    napi_call_threadsafe_function(self->menuCbTsfn_, data, napi_tsfn_blocking);
  };

  // dispatch 到主线程展示菜单
  dispatch_async(dispatch_get_main_queue(), ^{
    [view_ showContextMenu:menu];
  });

  return env.Undefined();
}

Napi::Value TrayItem::Destroy(const Napi::CallbackInfo& info) {
  if (view_) {
    [view_ cleanup];
    [view_ removeFromSuperview];
    view_ = nil;
  }
  // 在 JS 环境仍有效时释放 threadsafe functions
  if (buttonTsfn_) {
    napi_release_threadsafe_function(buttonTsfn_, napi_tsfn_release);
    buttonTsfn_ = nullptr;
  }
  if (rightTsfn_) {
    napi_release_threadsafe_function(rightTsfn_, napi_tsfn_release);
    rightTsfn_ = nullptr;
  }
  if (trayTsfn_) {
    napi_release_threadsafe_function(trayTsfn_, napi_tsfn_release);
    trayTsfn_ = nullptr;
  }
  if (menuCbTsfn_) {
    napi_release_threadsafe_function(menuCbTsfn_, napi_tsfn_release);
    menuCbTsfn_ = nullptr;
  }
  return info.Env().Undefined();
}

// ================ Module Init ================
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  g_env = env;
  TrayItem::Init(env, exports);
  return exports;
}

}

NODE_API_MODULE(tray_addon, Init)
