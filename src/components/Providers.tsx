"use client";

import { Provider } from "react-redux";
import { store } from "@/store/store";

/**
 * Client-side Redux store provider wrapper for Next.js App Router tree.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}

