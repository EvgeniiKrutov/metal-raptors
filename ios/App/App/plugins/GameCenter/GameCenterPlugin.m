#import <Capacitor/Capacitor.h>

CAP_PLUGIN(GameCenterPlugin, "GameCenter",
    CAP_PLUGIN_METHOD(authenticate, CAPPluginReturnPromise);
)
