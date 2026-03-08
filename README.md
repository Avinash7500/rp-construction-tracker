# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Push Notifications (FCM) Setup

This project now includes Firebase Cloud Messaging for:

- New task assigned
- Site reassigned
- Overdue task reminders (scheduled)
- Weekly pending reminders (scheduled)

### Frontend env

Create `.env` (or Vercel env) with:

```bash
VITE_FIREBASE_VAPID_KEY=YOUR_WEB_PUSH_CERTIFICATE_KEY_PAIR
```

### Backend Cloud Functions

Functions are in `functions/`.

Install and deploy:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Notes

- Web push on iOS requires iOS 16.4+ and app installed to Home Screen.
- Notification token is stored on `users/{uid}` as `pushToken` and `pushTokens`.
- Firestore rules may need update to allow clients to write push token fields on their own user document.
