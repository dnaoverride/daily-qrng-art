import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json() as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return NextResponse.json({ error: "Email i lozinka su obavezni." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Lozinka mora imati najmanje 8 karaktera." }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Korisnik sa ovim emailom već postoji." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const displayName = name?.trim() || email.split("@")[0];

    await db.insert(users).values({
      id,
      email,
      password: hashed,
      name: displayName,
      createdAt: new Date(),
    });

    return NextResponse.json({ id, email, name: displayName }, { status: 201 });
  } catch (err) {
    console.error("[register] Error:", err);
    return NextResponse.json({ error: "Greška servera." }, { status: 500 });
  }
}
