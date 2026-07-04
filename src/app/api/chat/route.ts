import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { answerBusinessQuestion } from "@/lib/business-chat";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const body = await request.json();

    const question =
      typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        {
          error: "Question is required.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await answerBusinessQuestion({
      userId: session.user.id,
      question,
    });

    return NextResponse.json({
      answer: result.answer,
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error("Business chat error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while answering your question.",
      },
      {
        status: 500,
      },
    );
  }
}