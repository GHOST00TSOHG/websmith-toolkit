---
name: swiftui-home-widgets
description: >-
  Use this when building an iPhone Home Screen or Lock Screen widget (or Live
  Activity) with SwiftUI and WidgetKit, including App Groups, timelines,
  interactive widgets, and installing on a personal iPhone.
---
# iPhone Home Screen widgets

Build widgets as a **Widget Extension** inside an Xcode iOS app, using WidgetKit and SwiftUI. The extension runs as a separate process from the app, and no third-party library is needed.

## Tools

Use the current **Xcode** from Apple. As of Nov 2026 that's **Xcode 27.2**, which needs macOS Tahoe 26.6 or later. You need full Xcode, not only the Command Line Tools. A free Apple Account (Personal Team) can run the app on up to three of your own iPhones, but its provisioning expires after 7 days. TestFlight, the App Store and Push Notifications need a paid Apple Developer Program membership ($99/year). **App Groups work on a free account.**

## Workflow

1. Go to File > New > Target > Widget Extension. Include a Live Activity only if you need one.
2. Add the **App Groups** capability to **both** the app and the extension, using the same `group.` identifier. Share data through `UserDefaults(suiteName:)` or `containerURL(forSecurityApplicationGroupIdentifier:)`, never `UserDefaults.standard`.
3. Implement a `TimelineProvider` that returns a placeholder, a snapshot, and a timeline of `TimelineEntry` values with a reload policy of `.atEnd`, `.after(date)` or `.never`. Space entries at least about 5 minutes apart; a widget people look at often typically gets about 40-70 reloads a day. When the app's data changes, call `WidgetCenter.shared.reloadTimelines(ofKind:)`.
4. For buttons on the widget (iOS 17+), add an `AppIntent` whose `perform()` writes to the App Group before it returns, then use `Button(intent:)` or `Toggle(isOn:intent:)`. Use `Link` or `.widgetURL` only to open the app. A tap on the widget always reloads the timeline and doesn't count against the daily budget.
5. Live Activities are started and updated with **ActivityKit**, not a timeline. Set `NSSupportsLiveActivities` in the app's Info.plist. They last up to 8 hours, plus up to 4 more on the Lock Screen. They can't use the network, and their data must stay under 4 KB. Skip ActivityKit push (`pushType: .token`) unless you have a paid membership.

## Command line

```bash
xcodebuild -scheme YourApp -destination 'platform=iOS Simulator,name=iPhone 16' build
xcrun devicectl list devices
xcrun devicectl device install app --device DEVICE_ID path/to/YourApp.app
xcrun devicectl device process launch --device DEVICE_ID com.example.yourapp
```

For builds on a real iPhone, pass `-allowProvisioningUpdates` to `xcodebuild`. Install with `devicectl`, and don't assume `xcodebuild install` will put the app on a personal iPhone.

## Don't

- Ship to the App Store or TestFlight without a paid membership and the owner's approval.
- Reload a countdown every minute. Use a date text style that updates on its own instead.
- Return from `perform()` before the shared data is saved.
- Mistake the 7-day Personal Team expiry for a bug in the code.
