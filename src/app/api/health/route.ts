export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "madarsa-erp",
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
