import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DollarSign, CreditCard, TrendingUp, Calendar } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCourier } from '@/context/CourierContext';
import { Button } from '@/components/Button';
import { WithSwipeGesture } from '@/components/WithSwipeGesture';

const TAB_ROUTES = [
  { name: 'orders', path: '/(tabs)/orders' },
  { name: 'finance', path: '/(tabs)/finance' },
  { name: 'settings', path: '/(tabs)/settings' },
];

export default function FinanceScreen() {
  const { t } = useTranslation();
  const { stats } = useCourier();

  const StatCard = ({ title, value, icon: Icon, subtext }: any) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={Colors.primary} />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>${value.toFixed(2)}</Text>
      {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
    </View>
  );

  return (
    <WithSwipeGesture routes={TAB_ROUTES} currentRouteName="finance">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('finance.title')}</Text>
        <Text style={styles.subtitle}>{t('finance.subtitle')}</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('finance.total_balance')}</Text>
        <Text style={styles.balanceValue}>${stats.monthEarnings.toFixed(2)}</Text>
        <Button 
          title={t('finance.withdraw_funds')} 
          variant="secondary"
          style={styles.withdrawButton}
          onPress={() => {}}
        />
      </View>

      <Text style={styles.sectionTitle}>{t('finance.overview')}</Text>
      
      <View style={styles.statsGrid}>
        <StatCard 
          title={t('common.today')} 
          value={stats.todayEarnings} 
          icon={DollarSign}
          subtext={t('finance.vs_yesterday')}
        />
        <StatCard 
          title={t('common.this_week')} 
          value={stats.weekEarnings} 
          icon={Calendar}
        />
      </View>
      
      <View style={styles.statsGrid}>
        <StatCard 
          title={t('finance.total_deliveries')} 
          value={stats.completedOrders} 
          icon={TrendingUp}
          // Using value as number here but treating as string in component for simplicity, in real app type check
        />
        <StatCard 
          title={t('finance.bonuses')} 
          value={45.00} 
          icon={CreditCard}
        />
      </View>

      <Text style={styles.sectionTitle}>{t('finance.recent_transactions')}</Text>
      
      <View style={styles.transactionsList}>
        {[1, 2, 3].map((_, i) => (
          <TouchableOpacity key={i} style={styles.transactionItem}>
            <View style={styles.transactionIcon}>
              <DollarSign size={20} color={Colors.success} />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionTitle}>{t('finance.weekly_payout')}</Text>
              <Text style={styles.transactionDate}>Nov {23 - i}, 2025</Text>
            </View>
            <Text style={styles.transactionAmount}>+$320.00</Text>
          </TouchableOpacity>
        ))}
      </View>
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
    marginBottom: 24,
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
  balanceCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
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
    fontSize: 40,
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
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.secondary,
  },
  statSubtext: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 4,
  },
  transactionsList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  transactionDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
});
