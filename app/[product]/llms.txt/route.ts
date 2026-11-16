import { createIntegrationInstructionsResponse } from "@/lib/integration-instructions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ product: string }> },
): Promise<Response> {
  const { product } = await params;
  return createIntegrationInstructionsResponse([product], request);
}
