export class RateLimiter {

  constructor(state, env) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    const key = url.searchParams.get("key");
    const limit = parseInt(url.searchParams.get("limit"));
    const windowMs = parseInt(url.searchParams.get("window"));

    const now = Date.now();

    let data = await this.state.storage.get(key);

    if (!data) {
      data = { count: 0, start: now };
    }

    // reset window
    if (now - data.start > windowMs) {
      data = { count: 0, start: now };
    }

    data.count++;

    await this.state.storage.put(key, data);

    if (data.count > limit) {
      return new Response(JSON.stringify({ allowed: false }), { status: 429 });
    }

    return new Response(JSON.stringify({ allowed: true }), { status: 200 });
  }
}
