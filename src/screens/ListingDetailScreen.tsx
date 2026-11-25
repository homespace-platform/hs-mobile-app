import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@/components/Icon';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BookingAppointmentModal from '@/components/appointment/BookingAppointmentModal';
import AppointmentsScreen from '@/components/appointment/manage/AppointmentsScreen';
import type { MainTab } from '@/components/BottomTabBar';
import ListingCard from '@/components/ListingCard';
import { Button } from '@/components/Screen';
import ContactCta from '@/components/listing-detail/ContactCta';
import { rentalModalProps } from '@/components/rental/requests/logic';
import RentalRequestModal from '@/components/rental/requests/RentalRequestModal';
import { useViewer } from '@/components/rental/requests/useViewer';
import { OwnListingCard, VisitorOwnerCard } from '@/components/listing-detail/OwnerCard';
import MediaGallery from '@/components/listing-detail/MediaGallery';
import NearbyPlaces from '@/components/listing-detail/NearbyPlaces';
import OverviewCard from '@/components/listing-detail/OverviewCard';
import {
  AmenitiesSection,
  DescriptionSection,
  DetailSections,
  FurnishingSection,
  PoliciesCard,
  ViewingSection,
} from '@/components/listing-detail/ListingSections';
import { createConversation, sendMessage, type RelatedListing } from '@/services/chatApi';
import {
  getAccessibleListing,
  getPublicListing,
  getPublicListings,
  listingImage,
  type ListingDetail,
  type ListingSummary,
} from '@/services/listingApi';
import { getFavoriteIds, toggleFavorite, recordListingHistory } from '@/services/favoriteApi';
import { getUserProfileApi } from '@/services/userApi';
import ListingDraftScreen from '@/screens/ListingDraftScreen';
import { apiError } from '@/lib/api-error';
import { isActiveBooking } from '@/lib/appointment';
import {
  formatPrice,
  getQuickMetrics,
  getRentDetailExtras,
  getRentDetailSections,
  toChatListing,
  toRentProperty,
} from '@/lib/rent-detail';
import { useFavoriteListings } from '@/lib/use-favorite-listings';
import { getMyBookingByListing } from '@/services/appointmentApi';
import type { RentalRoute } from '@/lib/rental-nav/routes';
import RentalNavigator from '@/screens/rental/RentalNavigator';
import rentalRequestService from '@/services/rental/rental-request.service';
import type { ManagementSection } from '@/services/managementApi';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

type SenderProfile = { displayName?: string; email?: string; avatarUrl?: string };

export default function ListingDetailScreen({
  listingId,
  onBack,
  onOpenMessages,
  onOpenManagement,
  onSelectTab,
  onOpenListing,
  own = false,
  accessible = false,
}: {
  listingId: string;
  onBack: () => void;
  onOpenMessages: (conversationId: string, pendingListing?: RelatedListing) => void;
  onOpenManagement: (section: ManagementSection) => void;
  onSelectTab: (tab: MainTab) => void;
  onOpenListing: (listingId: string) => void;
  own?: boolean;
  /** Opened from a rental record: read with the viewer's identity (the listing may not be public).
   * Access only, never ownership. */
  accessible?: boolean;
}) {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [favoriteReady, setFavoriteReady] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  // From the session: a favorites or profile failure must not hide the visitor actions.
  const { userId } = useViewer();
  const [senderProfile, setSenderProfile] = useState<SenderProfile | undefined>();
  const [editing, setEditing] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [rentalRequest, setRentalRequest] = useState<RentalRequestResponse | null>(null);
  const [rentalFormOpen, setRentalFormOpen] = useState(false);
  // A request sent for the previous listing can settle after this screen moved to another one.
  const shownListingId = useRef(listingId);
  // "Yêu cầu của tôi" opens here, so Back from the list returns to this listing.
  const [rentalStack, setRentalStack] = useState<RentalRoute[]>([]);
  const viewingRequests = rentalStack.length > 0;
  // A listing opened from that list is shown on top of it, so Back returns to the list.
  const [recordListingId, setRecordListingId] = useState<string | null>(null);
  const [hasActiveBooking, setHasActiveBooking] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [appointmentsOpen, setAppointmentsOpen] = useState(false);
  const [appointmentListingId, setAppointmentListingId] = useState<string | null>(null);
  const { favoriteIds: similarFavoriteIds, toggle: toggleSimilarFavorite } = useFavoriteListings();
  const [similarListings, setSimilarListings] = useState<ListingSummary[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const bodyY = useRef(0);
  const contactY = useRef(0);

  // Android Back = the header button. The request list and the editor have their own ScreenHeader;
  // modals take Back themselves.
  const hasOwnHeader = viewingRequests || editing || appointmentsOpen;
  useEffect(() => {
    if (hasOwnHeader) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => handler.remove();
  }, [hasOwnHeader, onBack]);

  useEffect(() => {
    shownListingId.current = listingId;
    setRentalRequest(null);
    setRentalFormOpen(false);
    setRentalStack([]);
    setRecordListingId(null);
    setHasActiveBooking(false);
    setBookingOpen(false);
    setAppointmentsOpen(false);
    setAppointmentListingId(null);
  }, [listingId, own]);

  // On entry (own listings too, as web) and again when the request form closes. Closing the request
  // list is web's re-entry: there it is another page. An unavailable lookup means "no request".
  useEffect(() => {
    if (rentalFormOpen || viewingRequests) return;
    let active = true;
    void rentalRequestService.getMyRequestByListing(listingId).then((request) => {
      if (active) setRentalRequest(request);
    });
    return () => {
      active = false;
    };
  }, [listingId, rentalFormOpen, viewingRequests]);

  // On entry and again each time the booking modal closes.
  useEffect(() => {
    if (own || bookingOpen) return;
    let active = true;
    getMyBookingByListing(listingId).then((booking) => {
      if (active) setHasActiveBooking(isActiveBooking(booking));
    });
    return () => {
      active = false;
    };
  }, [listingId, own, bookingOpen]);

  const loadInteractions = useCallback(async () => {
    setFavoriteReady(false);
    setChatError(null);
    try {
      const [ids, profile] = await Promise.all([getFavoriteIds(), getUserProfileApi()]);
      setFavorite(ids.includes(listingId));
      setSenderProfile({
        displayName:
          [profile.lastName, profile.firstName].filter(Boolean).join(' ') || profile.username,
        email: profile.email,
        avatarUrl: profile.avatarUrl ?? undefined,
      });
      setFavoriteReady(true);
    } catch (e) {
      setChatError(apiError(e));
    }
  }, [listingId]);
  useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);

  async function saveFavorite() {
    if (!favoriteReady || favoriteSaving) return;
    setFavoriteSaving(true);
    setChatError(null);
    try {
      setFavorite(await toggleFavorite(listingId));
    } catch (e) {
      setChatError(apiError(e));
    } finally {
      setFavoriteSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await (own || accessible
        ? getAccessibleListing(listingId)
        : getPublicListing(listingId));
      setListing(detail);
      // As on web, only a publicly visible listing goes into the view history.
      if (!own && (!accessible || ['PUBLISHED', 'RESERVED'].includes(detail.status)))
        void recordListingHistory(listingId).catch(() => undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được bài đăng');
    } finally {
      setLoading(false);
    }
  }, [listingId, own, accessible]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    const cityId = listing?.address?.cityId;
    if (!own && cityId && listing) {
      getPublicListings({ cityId, category: listing.category, page: 1, size: 8, sort: 'newest' })
        .then((items) => {
          if (active)
            setSimilarListings(items.filter((item) => item.id !== listing.id).slice(0, 6));
        })
        .catch(() => {
          if (active) setSimilarListings([]);
        });
    } else {
      setSimilarListings([]);
    }
    return () => {
      active = false;
    };
  }, [listing, own]);

  const property = useMemo(() => (listing ? toRentProperty(listing) : null), [listing]);

  const openAppointments = () => {
    setBookingOpen(false);
    setAppointmentsOpen(true);
  };

  if (appointmentsOpen && appointmentListingId)
    return (
      <ListingDetailScreen
        key={appointmentListingId}
        listingId={appointmentListingId}
        onBack={() => setAppointmentListingId(null)}
        onSelectTab={onSelectTab}
        onOpenListing={setAppointmentListingId}
        onOpenMessages={onOpenMessages}
        onOpenManagement={onOpenManagement}
      />
    );

  if (appointmentsOpen)
    return (
      <AppointmentsScreen
        role="RENTER"
        onBack={() => setAppointmentsOpen(false)}
        onSelectTab={onSelectTab}
        onOpenListing={setAppointmentListingId}
      />
    );

  if (viewingRequests && recordListingId)
    return (
      <ListingDetailScreen
        key={recordListingId}
        listingId={recordListingId}
        accessible
        onBack={() => setRecordListingId(null)}
        onOpenListing={setRecordListingId}
        onSelectTab={onSelectTab}
        onOpenMessages={onOpenMessages}
        onOpenManagement={onOpenManagement}
      />
    );

  if (viewingRequests)
    return (
      <RentalNavigator
        stack={rentalStack}
        onStackChange={setRentalStack}
        // Opened as the tenant's own requests.
        role="tenant"
        onOpenListing={setRecordListingId}
        onBrowseListings={() => {
          setRentalStack([]);
          onBack();
        }}
      />
    );

  if (editing)
    return (
      <ListingDraftScreen
        listingId={listingId}
        onBack={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void load();
        }}
      />
    );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator className="text-primary" />
        <Text className="mt-3 text-sm text-muted-foreground">Đang tải thông tin nhà...</Text>
      </SafeAreaView>
    );
  }

  if (!listing || !property || error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-base font-semibold text-foreground">
          Không thể mở bài đăng
        </Text>
        <Pressable onPress={load} className="mt-4 rounded-xl bg-brand px-5 py-3">
          <Text className="font-semibold text-on-brand">Thử lại</Text>
        </Pressable>
        <Pressable onPress={onBack} className="mt-3 px-5 py-3">
          <Text className="font-semibold text-muted-foreground">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isOwnerView = own || (Boolean(userId) && userId === property.ownerId);
  const showVisitorCta = !isOwnerView && Boolean(userId);
  const extras = getRentDetailExtras(property);
  const gallery = property.mediaItems.length
    ? property.mediaItems.map((item) => ({
        type: item.type,
        url: item.type === 'image' ? listingImage(item.url) : item.url,
      }))
    : [{ type: 'image' as const, url: listingImage(null) }];
  const status = String(property.status || '')
    .trim()
    .toUpperCase();
  const canEdit =
    ['APARTMENT', 'HOUSE', 'ROOM'].includes(listing.category) &&
    status !== 'RENTED_EXTERNALLY' &&
    status !== 'VIOLATION';
  const address = listing.address;

  // Same flow as web openPropertyChat: create/reuse the conversation, optionally send the quick
  // message (with the listing card), then open it.
  async function openPropertyChat(message?: string) {
    if (!property) return;
    const participantId = property.ownerId || property.landlord.id;
    if (!participantId) {
      setChatError('Bài đăng chưa có thông tin chủ nhà');
      return;
    }
    const chatListing = toChatListing(property, listingImage(property.images[0] ?? null));
    setOpeningChat(true);
    setChatError(null);
    try {
      // One conversation per pair: the listing card travels on a message, not on the conversation.
      const conversation = await createConversation(participantId, undefined, {
        displayName: property.landlord.name,
        avatarUrl: property.landlord.avatar,
      });
      if (message) {
        await sendMessage(conversation.id, message, chatListing, senderProfile);
        setQuickMessage('');
      }
      onOpenMessages(conversation.id, message ? undefined : chatListing);
    } catch (openError) {
      setChatError(apiError(openError));
    } finally {
      setOpeningChat(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="absolute left-0 right-0 top-12 z-10 flex-row justify-between px-4">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          className="h-11 w-11 items-center justify-center rounded-full bg-surface/95 shadow">
          <Ionicons name="chevron-back" size={25} className="text-foreground" />
        </Pressable>
        <Pressable
          onPress={saveFavorite}
          disabled={!favoriteReady || favoriteSaving}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Bỏ yêu thích' : 'Lưu yêu thích'}
          accessibilityState={{ selected: favorite, disabled: !favoriteReady || favoriteSaving }}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface/95 shadow">
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={24}
            className={favorite ? 'text-danger' : 'text-secondary'}
          />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerClassName={showVisitorCta ? 'pb-28' : 'pb-8'}>
        <MediaGallery items={gallery} />

        <View
          className="gap-4 bg-background p-4"
          onLayout={(event) => {
            bodyY.current = event.nativeEvent.layout.y;
          }}>
          <View
            onLayout={(event) => {
              contactY.current = event.nativeEvent.layout.y;
            }}>
            <OverviewCard
              property={property}
              metrics={getQuickMetrics(property)}
              highlights={extras.highlights}
              isNegotiable={extras.isNegotiable}>
              {showVisitorCta ? (
                <ContactCta
                  status={property.status}
                  publicListing={extras.publicListing}
                  isNegotiable={extras.isNegotiable}
                  isOwner={isOwnerView}
                  rentalRequest={rentalRequest}
                  hasActiveBooking={hasActiveBooking}
                  chatting={openingChat}
                  onChat={() => void openPropertyChat()}
                  onOpenRequests={() =>
                    setRentalStack([{ screen: 'rental-requests', mode: 'SENT' }])
                  }
                  onRequestRental={() => setRentalFormOpen(true)}
                  onOpenBookings={openAppointments}
                  onBook={() => setBookingOpen(true)}
                />
              ) : null}
            </OverviewCard>
          </View>

          {chatError ? (
            <View accessibilityRole="alert" className="rounded-2xl bg-danger-soft p-4">
              <Text className="text-center text-sm text-danger">{chatError}</Text>
              {!favoriteReady ? (
                <Button label="Thử tải lại thao tác" onPress={loadInteractions} />
              ) : null}
            </View>
          ) : null}

          {isOwnerView ? (
            <OwnListingCard
              landlord={property.landlord}
              canEdit={canEdit}
              onEdit={() => setEditing(true)}
              onManage={() => onOpenManagement('landlord-properties')}
            />
          ) : showVisitorCta ? (
            <VisitorOwnerCard
              landlord={property.landlord}
              message={quickMessage}
              onChangeMessage={setQuickMessage}
              sending={openingChat}
              onSend={() => quickMessage.trim() && void openPropertyChat(quickMessage)}
            />
          ) : null}

          <DetailSections sections={getRentDetailSections(property)} />
          <PoliciesCard
            rows={Array.isArray(property.details.policies) ? listing.policies : undefined}
          />
          <AmenitiesSection amenities={extras.amenities} />
          <FurnishingSection furnishing={extras.furnishing} />
          <ViewingSection days={extras.viewingDays} slots={extras.viewingSlots} />
          <DescriptionSection description={property.description} />
          <NearbyPlaces
            listingId={property.id}
            latitude={address?.latitude}
            longitude={address?.longitude}
          />

          {similarListings.length ? (
            <View className="mt-4">
              <Text className="text-lg font-bold text-foreground">Nhà tương tự</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Cùng loại nhà trong khu vực
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="-mx-4 mt-3 px-4">
                {similarListings.map((item) => (
                  <ListingCard
                    key={item.id}
                    listing={item}
                    favorite={similarFavoriteIds.has(item.id)}
                    onPress={() => onOpenListing(item.id)}
                    onToggleFavorite={() => void toggleSimilarFavorite(item.id)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {showVisitorCta ? (
        <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between gap-3 border-t border-border bg-surface px-4 pb-5 pt-3">
          <Text numberOfLines={1} className="min-w-0 flex-1 text-lg font-bold text-primary">
            {formatPrice(property.priceMillion)}
            <Text className="text-xs font-normal text-muted-foreground"> /tháng</Text>
          </Text>
          <Pressable
            onPress={() =>
              scrollRef.current?.scrollTo({ y: bodyY.current + contactY.current, animated: true })
            }
            accessibilityRole="button"
            className="min-h-11 items-center justify-center rounded-xl bg-brand px-6">
            <Text className="text-sm font-bold text-on-brand">Liên hệ</Text>
          </Pressable>
        </View>
      ) : null}

      <RentalRequestModal
        {...rentalModalProps(property)}
        isOpen={rentalFormOpen}
        onClose={() => setRentalFormOpen(false)}
        onSuccess={(created) => {
          if (created.listingId === shownListingId.current) setRentalRequest(created);
        }}
      />

      <BookingAppointmentModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onViewMyBookings={openAppointments}
        listingId={property.id}
        listingTitle={property.title}
        listingAddress={property.location}
        listingPrice={property.priceMillion * 1_000_000}
        listingThumbnail={property.images[0] ? listingImage(property.images[0]) : null}
        ownerId={property.ownerId || property.landlord.id}
      />
    </SafeAreaView>
  );
}
