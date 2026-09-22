import { NextResponse } from "next/server";
import { PastApiError } from "@/lib/past/client";
import { ask } from "@/lib/wiki/ask";
import { pastClient, readConfig } from "@/lib/wiki/config";

export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 1000;

interface AskBody {
  question?: unknown;
  asOf?: unknown;
}

/**
 * POST /api/ask { question, asOf? } -> WikiPage
 *
 * The only server route. It holds the project key so the browser never sees it, and it
 * translates past's refusals into something a reader can act on.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length === 0) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `Questions are capped at ${MAX_QUESTION_LENGTH} characters.` }, { status: 400 });
  }
  const asOf = typeof body.asOf === "string" && body.asOf.length > 0 ? body.asOf : undefined;
  if (asOf !== undefined && Number.isNaN(Date.parse(asOf))) {
    return NextResponse.json({ error: "asOf must be an ISO 8601 date." }, { status: 400 });
  }

  try {
    const page = await ask(pastClient(), question, { identity: readConfig().identity, asOf });
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof PastApiError) {
      return NextResponse.json({ error: describe(error) }, { status: error.status >= 500 ? 502 : error.status });
    }
    console.error("ask failed", error);
    return NextResponse.json({ error: "past could not be reached." }, { status: 502 });
  }
}

function describe(error: PastApiError): string {
  switch (error.status) {
    case 401:
      return "past refused the project key. Check PAST_API_KEY.";
    case 403:
      return "This project is archived, so it can no longer be read.";
    case 400:
      return error.message;
    default:
      return `past answered ${error.status} (${error.code}).`;
  }
}
