import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = "http://127.0.0.1:8888/callback";
const supabaseProjectRef = "arjwrycitgobvlodmkeo";

if (!clientId || !clientSecret) {
  console.error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required.");
  process.exit(1);
}

const state = randomBytes(24).toString("hex");
const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
authorizeUrl.search = new URLSearchParams({
  response_type: "code",
  client_id: clientId,
  scope: [
    "user-read-currently-playing",
    "user-read-playback-state",
    "user-read-recently-played",
    "user-top-read",
  ].join(" "),
  redirect_uri: redirectUri,
  state,
  show_dialog: "true",
}).toString();

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, redirectUri);

  if (requestUrl.pathname !== "/callback") {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found.");
    return;
  }

  if (requestUrl.searchParams.get("state") !== state) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Spotify authorization state did not match.");
    console.error("Spotify authorization state did not match.");
    server.close();
    return;
  }

  const spotifyError = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  if (spotifyError || !code) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Spotify authorization failed: ${spotifyError ?? "missing code"}`);
    console.error(`Spotify authorization failed: ${spotifyError ?? "missing code"}`);
    server.close();
    return;
  }

  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.refresh_token) {
      throw new Error(
        tokenData.error_description
        ?? tokenData.error
        ?? "Spotify did not return a refresh token.",
      );
    }

    const supabaseArguments = [
      "--yes",
      "supabase@latest",
      "secrets",
      "set",
      `SPOTIFY_REFRESH_TOKEN=${tokenData.refresh_token}`,
      "--project-ref",
      supabaseProjectRef,
    ];
    const secretResult = process.platform === "win32"
      ? spawnSync(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", `npx ${supabaseArguments.join(" ")}`],
        { stdio: "inherit" },
      )
      : spawnSync("npx", supabaseArguments, { stdio: "inherit" });
    if (secretResult.error || secretResult.status !== 0) {
      throw new Error(
        secretResult.error?.message
        ?? `Supabase secret update exited with code ${secretResult.status}.`,
      );
    }

    console.log("\nSpotify authorization and Supabase secret update completed.");
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Authorization complete. The new token was stored in Supabase.");
  } catch (error) {
    console.error(`Token exchange failed: ${error.message}`);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Token exchange failed. Return to the terminal for details.");
  } finally {
    server.close();
  }
});

server.listen(8888, "127.0.0.1", () => {
  console.log("Spotify callback helper is listening on http://127.0.0.1:8888");
  console.log("\nOpen this URL in your browser:\n");
  console.log(authorizeUrl.toString());
});

server.on("error", (error) => {
  console.error(`Unable to start callback server: ${error.message}`);
  process.exitCode = 1;
});
