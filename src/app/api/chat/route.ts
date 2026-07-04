import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  answerBusinessQuestion,
  clearBusinessChatHistory,
  getBusinessChatHistory,
  getBusinessChatSuggestions,
  saveBusinessChatExchange,
} from "@/lib/business-chat";

async function getCurrentUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user?.id ?? null;
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const [messages, suggestions] = await Promise.all([
      getBusinessChatHistory(userId),
      getBusinessChatSuggestions(userId),
    ]);

    return NextResponse.json({
      messages,
      suggestions,
    });
  } catch (error) {
    console.error("Load business chat error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while loading chat history.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
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
      userId,
      question,
    });

    await saveBusinessChatExchange({
      userId,
      question,
      answer: result.answer,
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

export async function DELETE() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    await clearBusinessChatHistory(userId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Clear business chat error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while clearing chat history.",
      },
      {
        status: 500,
      },
    );
  }
}