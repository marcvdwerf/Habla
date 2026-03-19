export async function POST(req) {
  try {
    const body = await req.json();

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const d = await r.json();
    return Response.json(d);
  } catch (e) {
    return Response.json({ error: { message: e.message } }, { status: 500 });
  }
}
