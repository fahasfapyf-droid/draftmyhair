import { redirect } from "next/navigation";

export default function NewContentLegacyRedirect() {
  redirect("/dashboard/admin/content");
}
