# Nexife Attendance (Android demo)

A small Expo / React Native sample app for Android. It uses React, TypeScript,
and Node-based tooling like the Nexife Salon web app, while rendering native
mobile screens rather than running Next.js inside a web view.

## Run on an Android phone

1. Install Node.js 22.12 or newer.
2. From this folder, run `npm install`.
3. Install **Expo Go** on your Android phone.
4. Run `npm start` and scan the QR code with Expo Go. Keep your phone and
   computer on the same network.

If the QR code does not connect, check that Expo Go is opening the code and
that your phone and computer are on the same Wi-Fi. On restricted or public
Wi-Fi, try tunnel mode instead:

```sh
npm run start:tunnel
```

You can also open the project on an Android emulator: start an Android
emulator first, then run `npm run android`.

## Install the app without Expo Go

Build a standalone APK with Expo Application Services (EAS). This needs an
Expo account and an internet connection; the build runs in Expo's cloud.

From this folder:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

The first build may ask you to create or link an EAS project. When the build
finishes, open its build link on your Android phone, download the `.apk`, and
install it. Android may ask you to allow the browser to install unknown apps.
This APK runs on its own and does not require Expo Go or a QR code.

Alternatively, transfer the downloaded APK to your phone and open it there.
Only install APKs you built or trust.

## Sample sign-in

- Email: `meera@nexife.demo`
- Password: `demo123`

The sample sign-in is only a client-side demo; it does not authenticate against
the Nexife Salon server. Attendance is held in app memory for the current
session and is not saved to a device or sent to a server. The staff name, role,
shift, and salon location are sample content.


https://expo.dev/accounts/akhil-nexifes-team/projects/nexife-attendance/builds/cdcf05f4-36f2-4f24-abdc-4c97c90af312