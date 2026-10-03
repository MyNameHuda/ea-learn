import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthScreen } from "@/components/AuthScreen";

/**
 * Server component, deliberately thin.
 *
 * It exists as a server component so `searchParams` can be read here and handed
 * down as a plain prop. Reading it inside the client component with
 * `useSearchParams()` would force the page to opt out of static rendering (or
 * wrap the whole tree in Suspense) just to pre-fill one field.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  // The other half of "remember me": with a valid session there is nothing to
  // sign in to, and showing a login form to someone who is already signed in
  // is how people end up typing a password into the wrong place. This is what
  // makes "tinggal buka link-nya" true.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { email } = await searchParams;
  return <AuthScreen mode="login" initialEmail={email ?? ""} />;
}
