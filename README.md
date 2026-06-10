<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/fb6160b1-6c76-4277-838b-99e6847ddb32

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## CI / CD

Two GitHub Actions workflows run automatically:

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** (`.github/workflows/ci.yml`) | Every push to `main` / `claude/**` and all PRs | Lint → Typecheck → Test → Web build |
| **Android Build** (`.github/workflows/android.yml`) | Push to `main` and version tags `v*.*.*` | Debug APK on every push; signed release AAB on tags |

### Release signing (Play Store AAB)

Tag a release (`git tag v1.0.0 && git push --tags`) to trigger the signed AAB job.
It requires four repository secrets — set them under **Settings → Secrets → Actions**:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | Base64-encoded `.jks` keystore (`base64 -w0 release.keystore`) |
| `SIGNING_STORE_PASSWORD` | Keystore password |
| `SIGNING_KEY_ALIAS` | Key alias inside the keystore |
| `SIGNING_KEY_PASSWORD` | Key password |

Without these secrets the release job is skipped; debug APK builds are always unsigned and need no secrets.
