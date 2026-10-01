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
  const { email } = await searchParams;
  return <AuthScreen mode="login" initialEmail={email ?? ""} />;
}
