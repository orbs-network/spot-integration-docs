import { createIntegrationInstructionsResponse } from "@/lib/integration-instructions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ product: string; integration: string }> },
): Promise<Response> {
  const { product, integration } = await params;
  return createIntegrationInstructionsResponse([product, integration], request);
}
