export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // Ignore payload parsing errors and keep generic status message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}
