import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DollarSign, TrendingUp, Package, Wallet, Calendar } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DEFAULTS } from '@/constants/config';
import { useCourier, EarningsPeriod } from '@/context/CourierContext';
import { Button } from '@/components/Button';
import { WithSwipeGesture } from '@/components/WithSwipeGesture';

const TAB_ROUTES = [
  { name: 'orders', path: '/(tabs)/orders' },
  { name: 'finance', path: '/(tabs)/finance' },
  { name: 'settings', path: '/(tabs)/settings' },
];

export default function FinanceScreen() {
  const { t } = useTranslation();
  const { earnings, isLoadingEarnings, fetchEarnings } = useCourier();
  const [selectedPeriod, setSelectedPeriod] = useState<'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'>('THIS_WEEK');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchEarnings(selectedPeriod as EarningsPeriod);
  }, [selectedPeriod]);

  const handlePeriodChange = (period: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH') => {
    setSelectedPeriod(period);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEarnings(selectedPeriod as EarningsPeriod);
    setIsRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${DEFAULTS.CURRENCY_SYMBOL}`;
  };

  // Get earnings and deliveries based on selected period
  const getPeriodEarnings = () => {
    switch (selectedPeriod) {
      case 'TODAY':
        return earnings.todayEarnings;
      case 'THIS_WEEK':
        return earnings.weekEarnings;
      case 'THIS_MONTH':
        return earnings.monthEarnings;
      default:
        return 0;
    }
  };

  const getPeriodDeliveries = () => {
    switch (selectedPeriod) {
      case 'TODAY':
        return earnings.todayDeliveries;
      case 'THIS_WEEK':
        return earnings.weekDeliveries;
      case 'THIS_MONTH':
        return earnings.monthDeliveries;
      default:
        return 0;
    }
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'TODAY':
        return t('finance.today_earnings');
      case 'THIS_WEEK':
        return t('finance.week_earnings');
      case 'THIS_MONTH':
        return t('finance.month_earnings');
      default:
        return '';
    }
  };

  const PeriodButton = ({ period, label }: { period: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'; label: string }) => (
    <TouchableOpacity
      style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
      onPress={() => handlePeriodChange(period)}
    >
      <Text style={[styles.periodButtonText, selectedPeriod === period && styles.periodButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const StatCard = ({ title, value, icon: Icon, isAmount = true, color = Colors.primary }: {
    title: string;
    value: number;
    icon: any;
    isAmount?: boolean;
    color?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          <Icon size={20} color={color} />
        </View>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>
        {isAmount ? formatCurrency(value) : value.toString()}
      </Text>
    </View>
  );

  return (
    <WithSwipeGesture routes={TAB_ROUTES} currentRouteName="finance">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
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

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <PeriodButton period="TODAY" label={t('common.today')} />
          <PeriodButton period="THIS_WEEK" label={t('common.this_week')} />
          <PeriodButton period="THIS_MONTH" label={t('common.month')} />
        </View>

        {/* Period Earnings Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Calendar size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.balanceLabel}>{getPeriodLabel()}</Text>
          </View>
          {isLoadingEarnings ? (
            <ActivityIndicator size="large" color={Colors.surface} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Text style={styles.balanceValue}>{formatCurrency(getPeriodEarnings())}</Text>
              <View style={styles.periodDeliveriesRow}>
                <Package size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.periodDeliveriesText}>
                  {getPeriodDeliveries()} {t('finance.deliveries')}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* All-Time Stats */}
        <Text style={styles.sectionTitle}>{t('finance.all_time_stats')}</Text>

        <View style={styles.statsGrid}>
          <StatCard
            title={t('finance.total_earnings')}
            value={earnings.totalEarnings}
            icon={DollarSign}
            color={Colors.success}
          />
          <StatCard
            title={t('finance.total_deliveries')}
            value={earnings.totalDeliveries}
            icon={Package}
            isAmount={false}
            color={Colors.primary}
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title={t('finance.avg_per_delivery')}
            value={earnings.averagePerDelivery}
            icon={TrendingUp}
            color={Colors.accent}
          />
          <StatCard
            title={t('finance.pending_payout')}
            value={earnings.pendingPayout}
            icon={Wallet}
            color={Colors.warning}
          />
        </View>

        {/* Earnings Summary Table */}
        <Text style={styles.sectionTitle}>{t('finance.overview')}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('finance.today_earnings')}</Text>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryValue}>{formatCurrency(earnings.todayEarnings)}</Text>
              <Text style={styles.summaryDeliveries}>{earnings.todayDeliveries} {t('finance.deliveries')}</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('finance.week_earnings')}</Text>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryValue}>{formatCurrency(earnings.weekEarnings)}</Text>
              <Text style={styles.summaryDeliveries}>{earnings.weekDeliveries} {t('finance.deliveries')}</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('finance.month_earnings')}</Text>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryValue}>{formatCurrency(earnings.monthEarnings)}</Text>
              <Text style={styles.summaryDeliveries}>{earnings.monthDeliveries} {t('finance.deliveries')}</Text>
            </View>
          </View>
        </View>

        {/* Withdraw Button */}
        <Button
          title={t('finance.withdraw_funds')}
          variant="primary"
          style={styles.withdrawButton}
          onPress={() => {}}
        />
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
    paddingBottom: 100,
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
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  periodButtonTextActive: {
    color: Colors.surface,
  },
  balanceCard: {
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
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceValue: {
    color: Colors.surface,
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 12,
  },
  periodDeliveriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodDeliveriesText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
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
  statHeader: {
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
  summaryDeliveries: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  withdrawButton: {
    marginTop: 8,
  },
});
