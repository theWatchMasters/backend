const GOOGLE_TOKENINFO_ENDPOINT =
  'https://www.googleapis.com/oauth2/v3/tokeninfo';
const DISCORD_TOKEN_ENDPOINT = 'https://discord.com/api/oauth2/token';
const DISCORD_ME_ENDPOINT = 'https://discord.com/api/users/@me';
export async function handleGoogleSSO(
  access_token: string,
): Promise<string | null> {
  try {
    const sanitizedJWT = access_token.replace(/[^a-zA-Z0-9._-]/g, '');
    const response = await fetch(
      `${GOOGLE_TOKENINFO_ENDPOINT}?access_token=${sanitizedJWT}`,
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.email;
  } catch (error) {
    return null;
  }
}

export async function handleDiscordSSO(
  code: string,
  codeVerifier: string | undefined,
): Promise<string | null> {
  if (!codeVerifier) {
    return null;
  }
  try {
    const sanitizedJWT = code.replace(/[^a-zA-Z0-9._-]/g, '');
    const response = await fetch(DISCORD_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `client_id=${process.env.DISCORD_CLIENT_ID}&client_secret=${process.env.DISCORD_CLIENT_SECRET}&grant_type=authorization_code&code=${sanitizedJWT}&redirect_uri=${process.env.DISCORD_REDIRECT_URI}&code_verifier=${codeVerifier}`,
    });
    if (!response.ok) {
      return null;
    }
    const { access_token } = await response.json();
    const tokenInfoResponse = await fetch(DISCORD_ME_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    if (!tokenInfoResponse.ok) {
      return null;
    }
    return await tokenInfoResponse.json().then((data) => data.email);
  } catch (error) {
    return null;
  }
}
