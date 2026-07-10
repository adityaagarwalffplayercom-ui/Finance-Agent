import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteOwnAccountCompletely,
  deleteOwnBusinessData,
} from "@/lib/user-privacy-controls";

export const runtime = "nodejs";

async function getSessionUserId(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  return session?.user?.id ?? null;
}

async function readJsonSafely(request: Request) {
  try {
    return (await request.json()) as {
      mode?: string;
      confirmation?: string;
    };
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUserId(request);

  if (!userId) {
    return NextResponse.json(
      {
        error: "Unauthorized. Please log in to delete your data.",
      },
      {
        status: 401,
      },
    );
  }

  const body = await readJsonSafely(request);
  const mode = body.mode?.trim();

  if (mode === "business_data") {
    if (body.confirmation !== "DELETE_MY_BUSINESS_DATA") {
      return NextResponse.json(
        {
          error:
            "Confirmation required. Send confirmation: DELETE_MY_BUSINESS_DATA",
        },
        {
          status: 400,
        },
      );
    }

    const result = await deleteOwnBusinessData(userId);

    return NextResponse.json({
      message: "Your business data was deleted.",
      privacy: {
        adminAccess: false,
        userScoped: true,
        userIdUsedFromSessionOnly: true,
        accountDeleted: false,
      },
      result,
    });
  }

  if (mode === "account") {
    if (body.confirmation !== "DELETE_MY_ACCOUNT") {
      return NextResponse.json(
        {
          error: "Confirmation required. Send confirmation: DELETE_MY_ACCOUNT",
        },
        {
          status: 400,
        },
      );
    }

    const result = await deleteOwnAccountCompletely(userId);

    return NextResponse.json({
      message: "Your account and user-owned data were deleted.",
      privacy: {
        adminAccess: false,
        userScoped: true,
        userIdUsedFromSessionOnly: true,
        accountDeleted: true,
      },
      result,
    });
  }

  return NextResponse.json(
    {
      error: "Invalid mode. Use mode: business_data or mode: account.",
      examples: {
        deleteBusinessData: {
          mode: "business_data",
          confirmation: "DELETE_MY_BUSINESS_DATA",
        },
        deleteAccount: {
          mode: "account",
          confirmation: "DELETE_MY_ACCOUNT",
        },
      },
    },
    {
      status: 400,
    },
  );
}