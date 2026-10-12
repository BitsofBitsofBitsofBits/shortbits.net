# shortbits.net

The source for [shortbits.net](https://www.shortbits.net/), the terminal-themed
internet presence of BitsofBitsofBits.

## Features

- Responsive LinkTree-style social and project links
- Dark, light, accent, high-contrast, and reduced-motion display profiles
- Spotify now-playing integration through a Supabase Edge Function
- Private contact form backed by Supabase
- Persistent local achievements and a large collection of Easter eggs
- Adaptive performance mode for constrained or slow devices

## Local development

The public site is dependency-free. Serve the directory with any static server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly also works for most development, but a local HTTP
server more closely matches production behavior.

## Configuration

`supabase-config.js` contains the public Supabase project URL and publishable
key used by the browser. Spotify credentials are not stored in this repository;
the Edge Function reads them from Supabase secrets:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

Deploy the function with:

```powershell
npx --yes supabase@latest functions deploy "spotify-now-playing" `
  --project-ref "arjwrycitgobvlodmkeo" `
  --no-verify-jwt
```

## Deployment

The production site is served as static files from `/srv/bitsofbits/`.
When changing cached CSS or JavaScript, update its query-string version in the
HTML before publishing.
