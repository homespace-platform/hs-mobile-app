import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLayoutDraftStore } from '@/lib/branch-layout-draft';

/** One instance for the app, so its operations stay in order. */
export const branchDraftStore = createLayoutDraftStore(AsyncStorage);
