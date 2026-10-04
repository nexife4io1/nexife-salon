import { redirect } from "next/navigation";
import { getHomePath } from "@/server/auth/queries";

export default async function Home() {
  redirect(await getHomePath());
}
