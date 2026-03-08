import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const favorite = await prisma.favorite.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  if (!favorite) {
    return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
  }
  if (!favorite.isPublic) {
    const session = await auth();
    if (session?.user?.id !== favorite.userId) {
      return NextResponse.json({ error: "Zabranjen pristup." }, { status: 403 });
    }
  }
  return NextResponse.json({ favorite }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }
  const { id } = await params;
  // Jedan query: briše samo ako id i userId oba odgovaraju (bez findUnique + delete)
  const result = await prisma.favorite.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }
  const { id } = await params;

  const body = await req.json() as {
    title?: string;
    isPublic?: boolean;
  };

  // Dohvatamo samo ako treba shareToken logika (isPublic toggle)
  // Ako se menja samo title, možemo direktno updateMany
  const needsShareToken = body.isPublic === true;
  let existingShareToken: string | null = null;

  if (needsShareToken) {
    const existing = await prisma.favorite.findFirst({
      where: { id, userId: session.user.id },
      select: { shareToken: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
    }
    existingShareToken = existing.shareToken;
  }

  const updatedData: { title?: string; isPublic?: boolean; shareToken?: string | null } = {};
  if (body.title !== undefined) updatedData.title = body.title.trim() || "Bez naziva";
  if (body.isPublic !== undefined) {
    updatedData.isPublic = body.isPublic;
    if (body.isPublic && !existingShareToken) {
      updatedData.shareToken = randomBytes(8).toString("hex");
    }
    if (!body.isPublic) {
      updatedData.shareToken = null;
    }
  }

  // updateMany sa userId uslovom — bez findUnique pre update-a
  const result = await prisma.favorite.updateMany({
    where: { id, userId: session.user.id },
    data: updatedData,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
  }

  // Vraćamo ažurirani entitet (potreban klijentu za shareToken)
  const updated = await prisma.favorite.findUnique({ where: { id } });
  return NextResponse.json({ favorite: updated });
}
