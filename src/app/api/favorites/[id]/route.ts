import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { favorites, users } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const rows = await db
    .select({
      id: favorites.id,
      userId: favorites.userId,
      title: favorites.title,
      values: favorites.values,
      scenarioName: favorites.scenarioName,
      isPublic: favorites.isPublic,
      shareToken: favorites.shareToken,
      createdAt: favorites.createdAt,
      userName: users.name,
    })
    .from(favorites)
    .leftJoin(users, eq(favorites.userId, users.id))
    .where(eq(favorites.id, id))
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
  }

  const row = rows[0];
  // Drizzle/MySQL JSON može vratiti string umesto niza u nekim okruženjima
  const rawValues = row.values;
  const values = Array.isArray(rawValues)
    ? rawValues
    : typeof rawValues === "string"
      ? (JSON.parse(rawValues) as number[])
      : [];

  const favorite = {
    id: row.id,
    userId: row.userId,
    title: row.title,
    values,
    scenarioName: row.scenarioName,
    isPublic: row.isPublic,
    shareToken: row.shareToken,
    createdAt: row.createdAt,
    user: { name: row.userName },
  };

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

  const result = await db
    .delete(favorites)
    .where(and(eq(favorites.id, id), eq(favorites.userId, session.user.id)));

  if (result[0].affectedRows === 0) {
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

  const needsShareToken = body.isPublic === true;
  let existingShareToken: string | null = null;

  if (needsShareToken) {
    const [existing] = await db
      .select({ shareToken: favorites.shareToken })
      .from(favorites)
      .where(and(eq(favorites.id, id), eq(favorites.userId, session.user.id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
    }
    existingShareToken = existing.shareToken ?? null;
  }

  const updatedData: {
    title?: string;
    isPublic?: boolean;
    shareToken?: string | null;
  } = {};

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

  const result = await db
    .update(favorites)
    .set(updatedData)
    .where(and(eq(favorites.id, id), eq(favorites.userId, session.user.id)));

  if (result[0].affectedRows === 0) {
    return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
  }

  const [updated] = await db
    .select()
    .from(favorites)
    .where(eq(favorites.id, id))
    .limit(1);

  return NextResponse.json({ favorite: updated });
}
