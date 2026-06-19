import Foundation
import Capacitor
import GameKit

@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin {
    @objc func authenticate(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        player.authenticateHandler = { viewController, _ in
            if let vc = viewController {
                DispatchQueue.main.async {
                    self.bridge?.viewController?.present(vc, animated: true)
                }
                return
            }
            if player.isAuthenticated {
                call.resolve([
                    "isAuthenticated": true,
                    "userId": player.teamPlayerID
                ])
            } else {
                call.resolve([
                    "isAuthenticated": false,
                    "userId": NSNull()
                ])
            }
        }
    }
}
