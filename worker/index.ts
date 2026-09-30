// Static assets don't answer Range requests, and iOS Safari refuses to play
// <video> without 206 responses. Only /media/* runs through here.
interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const res = await env.ASSETS.fetch(req);
    const range = req.headers.get("range");
    if (!range || res.status !== 200) return res;

    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (!m[1] && !m[2])) return res;

    const buf = await res.arrayBuffer();
    const size = buf.byteLength;
    let start: number;
    let end: number;
    if (m[1]) {
      start = Number(m[1]);
      end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    } else {
      start = Math.max(0, size - Number(m[2])); // suffix range: last N bytes
      end = size - 1;
    }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }

    const headers = new Headers(res.headers);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Accept-Ranges", "bytes");
    return new Response(buf.slice(start, end + 1), { status: 206, headers });
  },
};
