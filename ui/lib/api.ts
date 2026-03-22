type ApiStatus = {
  status: string;
  timestamp: string;
};

export async function getApiStatus(): Promise<{ ok: true; data: ApiStatus } | { ok: false; error: string }> {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    return { ok: false, error: "API_BASE_URL is not configured" };
  }

  try {
    const response = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return { ok: false, error: `API returned ${response.status}` };
    }

    const data = (await response.json()) as ApiStatus;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
