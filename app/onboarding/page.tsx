import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * /onboarding is retired.
 *
 * Signup used to drop every new account here for a 3-step child profile setup
 * (name, age range, subjects). It was redundant twice over: the child already
 * types their own name when they open a quiz on /play/<uuid>/name, and the
 * parent's profile no longer lists children at all. Registration is now just
 * name + email + password, then an emailed verification code.
 *
 * The route is kept as a redirect so any bookmarked or shared link lands
 * somewhere useful instead of 404ing.
 */
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect("/dashboard");
}
