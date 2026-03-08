import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      scenarioName: true,
      isPublic: true,
      shareToken: true,
      createdAt: true,
      // values (1000 brojeva) se ne vraća u list viewu — preuzima se tek pri otvaranju jednog favorita
    },
  });

  return NextResponse.json({ favorites }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  const body = await req.json() as {
    values?: unknown;
    title?: string;
    scenarioName?: string;
    isPublic?: boolean;
  };

  if (!Array.isArray(body.values) || body.values.length !== 1000) {
    return NextResponse.json({ error: "Neispravan set vrednosti." }, { status: 400 });
  }

  const shareToken = body.isPublic ? randomBytes(8).toString("hex") : null;

  const favorite = await prisma.favorite.create({
    data: {
      userId: session.user.id,
      values: body.values,
      title: body.title?.trim() || "Bez naziva",
      scenarioName: body.scenarioName ?? null,
      isPublic: body.isPublic ?? false,
      shareToken,
    },
  });

  return NextResponse.json({ favorite }, { status: 201 });
}
