import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Star } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useCourier } from '@/context/CourierContext';
import { EmptyState } from '@/components/EmptyState';
import { formatRelativeTime } from '@/lib/formatting';
import logger from '@/lib/logger';

// API_ENDPOINTS-style path builder; move into constants/config.ts
// (API_ENDPOINTS.COURIER.REVIEWS) once that file is free to edit.
const REVIEWS_ENDPOINT = (page: number, size: number) =>
  `/api/v1/couriers/me/reviews?page=${page}&size=${size}`;

interface Review {
  id: number | string;
  orderId: number | string;
  consumerId?: number;
  consumerName: string;
  restaurantId?: number;
  courierId?: number;
  restaurantRating?: number;
  foodRating?: number;
  courierRating: number;
  comment: string;
  tags?: string;
  createdAt: string;
}

const PAGE_SIZE = 20;

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={16}
          color={star <= rating ? '#F59E0B' : Colors.border}
          fill={star <= rating ? '#F59E0B' : 'none'}
        />
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { authenticatedFetch } = useCourier();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async (pageNum: number, refresh = false) => {
    try {
      setError(null);
      const response = await authenticatedFetch(REVIEWS_ENDPOINT(pageNum, PAGE_SIZE));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();

      let items: Review[] = [];
      let pages = 1;

      if (json.success && json.data?.content) {
        // Paginated response
        items = json.data.content;
        pages = json.data.totalPages || 1;
      } else if (Array.isArray(json)) {
        // Flat array response
        items = json;
        pages = 1;
      } else if (Array.isArray(json.data)) {
        items = json.data;
        pages = 1;
      }

      if (refresh) {
        setReviews(items);
      } else {
        setReviews((prev) => [...prev, ...items]);
      }
      setTotalPages(pages);
    } catch (err) {
      logger.error('[Reviews] Failed to fetch reviews:', err);
      setError(t('reviews.loading_error'));
    }
  }, [authenticatedFetch, t]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchReviews(0, true);
      setIsLoading(false);
    };
    load();
  }, [fetchReviews]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPage(0);
    await fetchReviews(0, true);
    setIsRefreshing(false);
  }, [fetchReviews]);

  // Pagination
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || page + 1 >= totalPages) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchReviews(nextPage, false);
    setIsLoadingMore(false);
  }, [isLoadingMore, page, totalPages, fetchReviews]);

  const renderReviewItem = useCallback(({ item }: { item: Review }) => {
    const reviewerName = item.consumerName || t('reviews.anonymous');
    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewerInfo}>
            <View style={styles.reviewerAvatar}>
              <Text style={styles.reviewerInitial}>
                {reviewerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.reviewerName}>{reviewerName}</Text>
              <Text style={styles.reviewDate}>
                {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
          </View>
          <StarRating rating={item.courierRating} />
        </View>
        {item.comment ? (
          <Text style={styles.reviewComment}>{item.comment}</Text>
        ) : null}
        {item.tags ? (
          <View style={styles.tagsRow}>
            {item.tags.split(',').map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {item.orderId ? (
          <Text style={styles.reviewOrder}>
            {t('reviews.order', { orderId: item.orderId })}
          </Text>
        ) : null}
      </View>
    );
  }, [t]);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }, [isLoadingMore]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('reviews.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : error && reviews.length === 0 ? (
          <EmptyState
            type="general"
            title={t('reviews.loading_error')}
            actionLabel={t('common.retry') || 'Retry'}
            onAction={handleRefresh}
          />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={Star}
            type="custom"
            title={t('reviews.no_reviews')}
            message={t('reviews.no_reviews_description')}
          />
        ) : (
          <FlatList
            data={reviews}
            renderItem={renderReviewItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderFooter}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reviewerInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  reviewOrder: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 8,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
