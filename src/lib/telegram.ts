import crypto from "crypto";

export interface TelegramUserData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number;
}


/**
 * Validates Telegram initData according to Telegram WebApp specifications:
 * HMAC-SHA-256 with "WebAppData" secret key.
 * Checks auth_date to prevent replay attacks (24 hour expiration).
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string
): { isValid: boolean; user?: TelegramUserData; error?: string } {
  if (!initData || !botToken) {
    return { isValid: false, error: "Missing initData or botToken" };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) {
      return { isValid: false, error: "Missing hash parameter" };
    }

    urlParams.delete("hash");

    // Check expiration (24 hours)
    const authDateStr = urlParams.get("auth_date");
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > 86400) {
        return { isValid: false, error: "Authentication data has expired (24h limit)" };
      }
    }

    // Sort parameters alphabetically
    const params: string[] = [];
    urlParams.forEach((val, key) => {
      params.push(`${key}=${val}`);
    });
    params.sort();
    const dataCheckString = params.join("\n");

    // HMAC-SHA256 signature verification
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      return { isValid: false, error: "Invalid hash signature" };
    }

    const userParam = urlParams.get("user");
    if (userParam) {
      const user = JSON.parse(userParam) as TelegramUserData;
      return { isValid: true, user };
    }

    return { isValid: true };
  } catch (err: unknown) {
    return { isValid: false, error: err instanceof Error ? err.message : "Parsing error" };
  }
}
