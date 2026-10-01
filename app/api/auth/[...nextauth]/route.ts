// NextAuth route handler — exposes /api/auth/* endpoints
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
