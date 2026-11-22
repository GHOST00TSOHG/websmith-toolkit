# Install Xcode and the iOS Simulator

This is a checklist, not a script. Xcode comes from the Mac App Store. Accepting the licence needs `sudo`, so the machine's owner has to run that step.

These notes are for Apple Silicon macOS.

## 1. Install Xcode from the App Store

Install **Xcode** (the full app, not only Command Line Tools). After it finishes:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcode-select -p
```

You should see `/Applications/Xcode.app/Contents/Developer`.

## 2. Accept the licence

The owner runs this in Terminal and enters their password:

```bash
sudo xcodebuild -license accept
```

A bot cannot complete this step on its own.

## 3. Download the iOS Simulator runtime

```bash
xcodebuild -downloadPlatform iOS
```

This can take a long time and several gigabytes. To see what is installed:

```bash
xcrun simctl runtime list
```

## 4. Remove a duplicate runtime

`xcodebuild -downloadPlatform iOS` can leave a second copy of the same iOS version. List runtimes, then delete only the extra identifier:

```bash
xcrun simctl runtime list
xcrun simctl runtime delete <runtime-id>
xcrun simctl runtime list
```

Delete a duplicate only. Do not delete the runtime you are using.

## 5. Check that a simulator boots

```bash
xcrun simctl list devices available
```

You should see current iPhone simulators. Open one from Xcode, or boot it with `xcrun simctl boot <device-id>` if you need a headless check.

## Licence

Xcode and the iOS Simulator are Apple software. Use them under Apple's licence terms from the App Store.
