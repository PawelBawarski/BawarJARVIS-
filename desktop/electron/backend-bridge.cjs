const PRIVATE_HEALTH_URL =
  "http://127.0.0.1:8080/api/security/private-health";

async function checkPrivateHealth(token, fetchImpl = fetch) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return { status: "unavailable" };
  }

  try {
    const response = await fetchImpl(PRIVATE_HEALTH_URL, {
      method: "GET",
      headers: { "X-Jarvis-Session": token },
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });

    if (response.status !== 200) {
      return { status: "unavailable" };
    }

    const body = await response.json();
    return {
      status: body?.status === "AUTHENTICATED"
        ? "authenticated"
        : "unavailable",
    };
  } catch {
    return { status: "unavailable" };
  }
}

module.exports = { checkPrivateHealth, PRIVATE_HEALTH_URL };
