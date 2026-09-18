export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "ilmgaah",
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
