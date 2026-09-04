import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DollarSign, Banknote, CreditCard, Wallet } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCourier } from '@/context/CourierContext';
import { WithSwipeGesture, TAB_ROUTES } from '@/components/WithSwipeGesture';
import { formatCurrency } from '@/lib/formatting';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FinanceScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  // Edge-to-edge: the window starts behind the status bar, so a fixed
  // paddingTop puts this content underneath it. See hooks/useBottomInset
  // for the full explanation - the same applies at the top edge.
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { earnings, isLoadingEarnings, fetchEarnings } = useCourier();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Backend-verified: the earnings endpoint ignores period/date params
  // entirely and returns its own computed window. A date-range picker here
  // was lying UI — filtering did nothing.
  useEffect(() => {
    fetchEarnings();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEarnings();
    setIsRefreshing(false);
  };

  return (
    <WithSwipeGesture routes={TAB_ROUTES} currentRouteName="finance">
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: tabBarHeight + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('finance.title')}</Text>
          <Text style={styles.subtitle}>{t('finance.subtitle')}</Text>
        </View>

        {/* Earnings Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <DollarSign size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.heroLabel}>{t('finance.total_earnings')}</Text>
          </View>
          {isLoadingEarnings ? (
            <ActivityIndicator size="large" color={Colors.surface} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Text style={styles.heroValue}>{formatCurrency(earnings.totalEarnings)}</Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>{t('finance.today_earnings')}</Text>
                  <Text style={styles.heroStatValue}>{formatCurrency(earnings.todayEarnings)}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>{t('finance.total_deliveries')}</Text>
                  <Text style={styles.heroStatValue}>{earnings.totalDeliveries}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>{t('finance.avg_per_delivery')}</Text>
                  <Text style={styles.heroStatValue}>{formatCurrency(earnings.averagePerDelivery)}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Payment Breakdown */}
        <Text style={styles.sectionTitle}>{t('finance.payment_breakdown')}</Text>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownIconRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#10B98115' }]}>
                <Banknote size={20} color={Colors.success} />
              </View>
            </View>
            <Text style={styles.breakdownLabel}>{t('finance.cash_earnings')}</Text>
            {isLoadingEarnings ? (
              <ActivityIndicator size="small" color={Colors.success} style={{ marginTop: 4 }} />
            ) : (
              <Text style={[styles.breakdownValue, { color: Colors.success }]}>
                {formatCurrency(earnings.cashEarnings)}
              </Text>
            )}
          </View>

          <View style={styles.breakdownCard}>
            <View style={styles.breakdownIconRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#3B82F615' }]}>
                <CreditCard size={20} color="#3B82F6" />
              </View>
            </View>
            <Text style={styles.breakdownLabel}>{t('finance.card_earnings')}</Text>
            {isLoadingEarnings ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 4 }} />
            ) : (
              <Text style={[styles.breakdownValue, { color: '#3B82F6' }]}>
                {formatCurrency(earnings.cardEarnings)}
              </Text>
            )}
          </View>
        </View>

        {/* Withdrawable Balance */}
        <Text style={styles.sectionTitle}>{t('finance.withdrawable_balance')}</Text>

        <View style={styles.withdrawableCard}>
          <View style={styles.withdrawableTop}>
            <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '15' }]}>
              <Wallet size={22} color={Colors.primary} />
            </View>
            <View style={styles.withdrawableInfo}>
              {isLoadingEarnings ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.withdrawableAmount}>
                  {formatCurrency(earnings.withdrawableBalance)}
                </Text>
              )}
              <Text style={styles.withdrawableNote}>
                {t('finance.card_payments_available')}
              </Text>
            </View>
          </View>
        </View>

        {/* Payout info — withdrawals are handled by the platform, not in-app */}
        <Text style={styles.payoutInfoText}>
          {t(
            'finance.payout_info',
            'Payouts are processed by the platform. Card-payment balances are settled to your registered account.'
          )}
        </Text>
      </ScrollView>
    </WithSwipeGesture>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    // paddingTop/paddingBottom are applied at the call site.
    // paddingBottom is applied at the call site from useBottomTabBarHeight().
  },
  header: {
    marginBottom: 20,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.secondary,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  heroValue: {
    color: Colors.surface,
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 4,
  },
  heroStatValue: {
    fontSize: 14,
    color: Colors.surface,
    fontWeight: '700',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  breakdownCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  breakdownIconRow: {
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  withdrawableCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  withdrawableTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  withdrawableInfo: {
    flex: 1,
  },
  withdrawableAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  withdrawableNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  payoutInfoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: -12,
    paddingHorizontal: 4,
  },
});
