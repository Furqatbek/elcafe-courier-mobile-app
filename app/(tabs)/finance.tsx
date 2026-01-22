import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DollarSign, Clock, TrendingUp, Package, Gift } from 'lucide-react-native';
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
  const { earnings, earningsPeriod, isLoadingEarnings, fetchEarnings } = useCourier();
  const [selectedPeriod, setSelectedPeriod] = useState<EarningsPeriod>(earningsPeriod);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchEarnings(selectedPeriod);
  }, [selectedPeriod]);

  const handlePeriodChange = (period: EarningsPeriod) => {
    setSelectedPeriod(period);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEarnings(selectedPeriod);
    setIsRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ${DEFAULTS.CURRENCY_SYMBOL}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const PeriodButton = ({ period, label }: { period: EarningsPeriod; label: string }) => (
    <TouchableOpacity
      style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
      onPress={() => handlePeriodChange(period)}
    >
      <Text style={[styles.periodButtonText, selectedPeriod === period && styles.periodButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const StatCard = ({ title, value, icon: Icon, isAmount = true }: {
    title: string;
    value: number;
    icon: any;
    isAmount?: boolean;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={Colors.primary} />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>
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

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('finance.total_earnings')}</Text>
          {isLoadingEarnings ? (
            <ActivityIndicator size="large" color={Colors.surface} style={{ marginVertical: 20 }} />
          ) : (
            <Text style={styles.balanceValue}>{formatCurrency(earnings.totalEarnings)}</Text>
          )}
          <Button
            title={t('finance.withdraw_funds')}
            variant="secondary"
            style={styles.withdrawButton}
            onPress={() => {}}
          />
        </View>

        {/* Stats Overview */}
        <Text style={styles.sectionTitle}>{t('finance.overview')}</Text>

        <View style={styles.statsGrid}>
          <StatCard
            title={t('finance.delivery_fees')}
            value={earnings.deliveryFees}
            icon={DollarSign}
          />
          <StatCard
            title={t('finance.tips')}
            value={earnings.tips}
            icon={Gift}
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title={t('finance.total_deliveries')}
            value={earnings.totalDeliveries}
            icon={Package}
            isAmount={false}
          />
          <StatCard
            title={t('finance.avg_per_delivery')}
            value={earnings.avgPerDelivery}
            icon={TrendingUp}
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title={t('finance.online_hours')}
            value={earnings.onlineHours}
            icon={Clock}
            isAmount={false}
          />
        </View>

        {/* Earnings Breakdown */}
        {earnings.breakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('finance.breakdown')}</Text>
            <View style={styles.breakdownList}>
              {earnings.breakdown.map((item, index) => (
                <View
                  key={item.date}
                  style={[
                    styles.breakdownItem,
                    index === earnings.breakdown.length - 1 && styles.breakdownItemLast
                  ]}
                >
                  <View style={styles.breakdownLeft}>
                    <Text style={styles.breakdownDate}>{formatDate(item.date)}</Text>
                    <Text style={styles.breakdownDeliveries}>
                      {item.deliveries} {t('finance.deliveries')}
                    </Text>
                  </View>
                  <Text style={styles.breakdownAmount}>
                    {formatCurrency(item.earnings)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Empty State for Breakdown */}
        {!isLoadingEarnings && earnings.breakdown.length === 0 && (
          <View style={styles.emptyBreakdown}>
            <Text style={styles.emptyText}>{t('finance.no_earnings_period')}</Text>
          </View>
        )}
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
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  balanceValue: {
    color: Colors.surface,
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 24,
  },
  withdrawButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.secondary,
  },
  breakdownList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  breakdownItemLast: {
    borderBottomWidth: 0,
  },
  breakdownLeft: {
    flex: 1,
  },
  breakdownDate: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  breakdownDeliveries: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
  emptyBreakdown: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
  },
});
