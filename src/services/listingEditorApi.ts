import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createListingForm,
  getTodayDateString,
  selectBranch,
  type ListingEditorMode,
} from '@/lib/listing-form';
import {
  createListingSession,
  listingErrorMessage,
  loadErrorMessage,
  maybeSavedFlag,
  openListing,
  saveListing,
  type SaveListingCallbacks,
  type SaveListingInput,
  type SaveListingResult,
} from '@/lib/listing-editor';
import { listRooms } from '@/lib/listing-room-link';
import { getBranches } from '@/services/branchApi';
import { branchLayoutApi } from '@/services/branchMonitorApi';
import { getAccessibleListing } from '@/services/listingApi';
import { upsertListing } from '@/services/listingCreateApi';
import { fileSessionGuard, withFileLease } from '@/services/rental/cache';
import { uploadFile } from '@/services/storageApi';
import { getUserProfileApi } from '@/services/userApi';

/** Everything the editor needs on open. Throws an Error with the message to show full screen. */
export async function loadListingEditor(options: {
  listingId?: string;
  duplicateFromId?: string;
  /** Create only: preselect this branch. */
  branchId?: string;
}) {
  const { listingId, duplicateFromId, branchId } = options;
  const mode: ListingEditorMode = listingId ? 'edit' : duplicateFromId ? 'duplicate' : 'create';
  const [branches, profile] = await Promise.all([
    getBranches().catch(() => []),
    getUserProfileApi().catch(() => null),
  ]);
  const savedAddress = profile?.address ?? null;
  const target = listingId || duplicateFromId;
  if (target) {
    const detail = await getAccessibleListing(target).catch(() => {
      throw new Error(loadErrorMessage(mode));
    });
    const opened = openListing(
      detail,
      mode as 'edit' | 'duplicate',
      branches,
      getTodayDateString()
    );
    return { ...opened, branches, savedAddress };
  }
  const blank = createListingForm({ hasSavedAddress: Boolean(savedAddress) });
  const chosen = branchId ? selectBranch(blank, branchId, branches, mode) : { state: blank };
  return {
    notice: undefined,
    ...chosen,
    session: createListingSession(),
    branches,
    savedAddress,
  };
}

/** Save draft / submit: KYC re-check, leased files, upload, upsert. Never throws. */
export async function submitListing(
  input: SaveListingInput,
  callbacks: SaveListingCallbacks = {}
): Promise<SaveListingResult> {
  const checkSession = fileSessionGuard();
  const { images, videos } = input.state.basicInfo;
  const uris = [...images, ...videos].flatMap((item) => (item.file ? [item.file.uri] : []));
  try {
    // Every picked file is leased until the submit settles, also across a sign-out.
    return await withFileLease(uris, async () => {
      let profile = await getUserProfileApi();
      if (!profile.kycVerified) profile = await getUserProfileApi(true);
      return saveListing(
        { ...input, profile },
        {
          ...callbacks,
          unconfirmed: maybeSavedFlag(AsyncStorage, profile.id, input.session),
          upload: async (file, kind) => {
            checkSession();
            const stored = await uploadFile(file, {
              purpose: kind === 'IMAGE' ? 'LISTING_IMAGE' : 'LISTING_VIDEO',
              visibility: 'PUBLIC',
              referenceType: 'LISTING',
              referenceId: 'listing',
            });
            return stored.id;
          },
          hasRoom: async ({ branchId, roomId }) =>
            listRooms(await branchLayoutApi.getLayout(branchId)).some((room) => room.id === roomId),
          upsert: async (payload) => {
            checkSession();
            return upsertListing(payload);
          },
        }
      );
    });
  } catch (error) {
    return { status: 'error', message: listingErrorMessage(error) };
  }
}
