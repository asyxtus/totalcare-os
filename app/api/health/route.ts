export async function HEAD() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  return Response.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
