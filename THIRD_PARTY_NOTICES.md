# Third-party notices

EzScene is MIT-licensed. It uses the open-source packages below, each under its
own license. Their license texts ship inside each package in `node_modules/`
after `npm install`.

| Package | Used for | License |
|---|---|---|
| react, react-dom | UI rendering | MIT |
| vite, @vitejs/plugin-react, vite-plugin-singlefile | Build tooling | MIT |
| tailwindcss, @tailwindcss/vite | Styling | MIT |
| lucide-react | Icons | ISC |
| jspdf | Drawing the stamped PDF | MIT |
| pdf-lib | Appending the signed sheet to a student's own PDF | MIT |
| qrcode | Verification QR codes | MIT |
| js-sha256 | Hash-chaining the audit log | MIT |
| @supabase/supabase-js | Optional shared database and realtime sync | MIT |
| @google/genai | Optional Gemini help assistant (server side) | Apache-2.0 |
| express, dotenv | Local dev server for the assistant endpoint | MIT, BSD-2-Clause |
| @fontsource/archivo | Archivo typeface (Omnibus-Type) | SIL OFL 1.1 |
| @fontsource/pacifico | Pacifico typeface (Vernon Adams) | SIL OFL 1.1 |
| vitest, typescript, @types/* | Tests and type checking (dev only) | MIT / Apache-2.0 |

The fonts are bundled under the SIL Open Font License 1.1, which allows
embedding and redistribution with software; the fonts themselves are not
sold on their own.
