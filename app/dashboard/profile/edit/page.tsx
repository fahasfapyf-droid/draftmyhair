import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateProfile } from "../actions";

export default async function EditProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      name: true,
      email: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-semibold">
        Edit Profile
      </h1>

      <p className="mt-2 text-brand-muted">
        Update your account information.
      </p>

      <form
  action={updateProfile}
  className="mt-10 space-y-6"
>
        <div>
          <label className="mb-2 block text-sm font-medium">
            Full Name
          </label>

          <input
            name="name"
            defaultValue={user.name ?? ""}
            className="w-full rounded-editorial border border-brand-border px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Email
          </label>

          <input
            value={user.email ?? ""}
            disabled
            className="w-full rounded-editorial border border-brand-border bg-gray-100 px-4 py-3"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="rounded-editorial bg-brand-ink px-6 py-3 text-white"
          >
            Save Changes
          </button>

          <Link
            href="/dashboard/profile"
            className="rounded-editorial border border-brand-border px-6 py-3"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}