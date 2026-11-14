import { cache } from "react";
import { auth } from "@/auth";

/** The session, read once per request however many components ask for it. */
export const getSession = cache(() => auth());
