import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store";

/**
 * Pre-typed Redux hooks for component dispatch and selection.
 *
 * Bakes RootState and AppDispatch types into useAppDispatch and useAppSelector hooks.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

