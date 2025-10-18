import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';

const { width: screenWidth } = Dimensions.get('window');

interface TripData {
  route: { latitude: number; longitude: number }[];
  distance: string;
  emissions: string;
  timestamp: string;
}

interface AnalyticsData {
  totalDistance: number;
  totalEmissions: number;
  averageEmissions: number;
  tripCount: number;
  chartData: {
    emissions: number[];
    distances: number[];
    labels: string[];
  };
  pieData: Array<{
    name: string;
    population: number;
    color: string;
    legendFontColor: string;
    legendFontSize: number;
  }>;
}

type FilterPeriod = 'all' | '7days' | '30days';

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [trips, setTrips] = useState<TripData[]>([]);

  useEffect(() => {
    loadAndProcessData();
  }, [filterPeriod]);

  const loadAndProcessData = async () => {
    setLoading(true);
    try {
      const storedTrips = await AsyncStorage.getItem('TRIPS');
      if (storedTrips) {
        const parsedTrips: TripData[] = JSON.parse(storedTrips);
        const filteredTrips = filterTripsByPeriod(parsedTrips);
        setTrips(filteredTrips);
        const processedData = processAnalyticsData(filteredTrips);
        setAnalyticsData(processedData);
      } else {
        setAnalyticsData({
          totalDistance: 0,
          totalEmissions: 0,
          averageEmissions: 0,
          tripCount: 0,
          chartData: { emissions: [], distances: [], labels: [] },
          pieData: [],
        });
      }
    } catch (error) {
      console.error('Error loading trips data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTripsByPeriod = (trips: TripData[]): TripData[] => {
    if (filterPeriod === 'all') return trips;

    const now = new Date();
    const daysToSubtract = filterPeriod === '7days' ? 7 : 30;
    const cutoffDate = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);

    return trips.filter(trip => {
      const tripDate = new Date(trip.timestamp);
      return tripDate >= cutoffDate;
    });
  };

  const processAnalyticsData = (trips: TripData[]): AnalyticsData => {
    if (trips.length === 0) {
      return {
        totalDistance: 0,
        totalEmissions: 0,
        averageEmissions: 0,
        tripCount: 0,
        chartData: { emissions: [], distances: [], labels: [] },
        pieData: [],
      };
    }

    const totalDistance = trips.reduce((sum, trip) => sum + parseFloat(trip.distance), 0);
    const totalEmissions = trips.reduce((sum, trip) => sum + parseFloat(trip.emissions), 0);
    const averageEmissions = totalEmissions / trips.length;

    // Prepare chart data (last 10 trips for better visualization)
    const recentTrips = trips.slice(-10);
    const emissions = recentTrips.map(trip => parseFloat(trip.emissions));
    const distances = recentTrips.map(trip => parseFloat(trip.distance));
    const labels = recentTrips.map((trip, index) => `Trip ${index + 1}`);

    // Prepare pie chart data based on emission ranges
    const lowEmissions = trips.filter(trip => parseFloat(trip.emissions) <= 2).length;
    const mediumEmissions = trips.filter(trip => 
      parseFloat(trip.emissions) > 2 && parseFloat(trip.emissions) <= 5
    ).length;
    const highEmissions = trips.filter(trip => parseFloat(trip.emissions) > 5).length;

    const pieData = [
      {
        name: 'Low (≤2kg)',
        population: lowEmissions,
        color: '#4ade80',
        legendFontColor: '#374151',
        legendFontSize: 12,
      },
      {
        name: 'Medium (2-5kg)',
        population: mediumEmissions,
        color: '#fbbf24',
        legendFontColor: '#374151',
        legendFontSize: 12,
      },
      {
        name: 'High (>5kg)',
        population: highEmissions,
        color: '#ef4444',
        legendFontColor: '#374151',
        legendFontSize: 12,
      },
    ].filter(item => item.population > 0);

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalEmissions: Math.round(totalEmissions * 100) / 100,
      averageEmissions: Math.round(averageEmissions * 100) / 100,
      tripCount: trips.length,
      chartData: { emissions, distances, labels },
      pieData,
    };
  };

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.7,
    decimalPlaces: 1,
    style: {
      borderRadius: 16,
    },
  };

  const FilterButton = ({ period, label }: { period: FilterPeriod; label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filterPeriod === period && styles.filterButtonActive,
      ]}
      onPress={() => setFilterPeriod(period)}
    >
      <Text
        style={[
          styles.filterButtonText,
          filterPeriod === period && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const SummaryCard = ({ 
    title, 
    value, 
    unit, 
    colors 
  }: { 
    title: string; 
    value: number | string; 
    unit: string;
    colors: string[];
  }) => (
    <LinearGradient colors={colors as [string, string]} style={styles.summaryCard}>
      <Text style={styles.summaryCardTitle}>{title}</Text>
      <Text style={styles.summaryCardValue}>
        {value} <Text style={styles.summaryCardUnit}>{unit}</Text>
      </Text>
    </LinearGradient>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analyticsData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Failed to load analytics data</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics Dashboard</Text>
          <Text style={styles.headerSubtitle}>Track your CO₂ emissions</Text>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <FilterButton period="all" label="All Time" />
          <FilterButton period="30days" label="Last 30 Days" />
          <FilterButton period="7days" label="Last 7 Days" />
        </View>

        {analyticsData.tripCount === 0 ? (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No trip data available</Text>
            <Text style={styles.noDataSubtext}>Start tracking your journeys to see analytics</Text>
          </View>
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <SummaryCard
                  title="Total Distance"
                  value={analyticsData.totalDistance}
                  unit="km"
                  colors={['#3b82f6', '#1d4ed8']}
                />
                <SummaryCard
                  title="Total CO₂"
                  value={analyticsData.totalEmissions}
                  unit="kg"
                  colors={['#ef4444', '#dc2626']}
                />
              </View>
              <View style={styles.summaryRow}>
                <SummaryCard
                  title="Average CO₂/Trip"
                  value={analyticsData.averageEmissions}
                  unit="kg"
                  colors={['#10b981', '#059669']}
                />
                <SummaryCard
                  title="Total Trips"
                  value={analyticsData.tripCount}
                  unit=""
                  colors={['#8b5cf6', '#7c3aed']}
                />
              </View>
            </View>

            {/* Charts */}
            <View style={styles.chartsContainer}>
              {/* CO₂ Emissions Bar Chart */}
              {analyticsData.chartData.emissions.length > 0 && (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>CO₂ Emissions by Trip</Text>
                  <BarChart
  data={{
    labels: analyticsData.chartData.labels,
    datasets: [
      {
        data: analyticsData.chartData.emissions,
      },
    ],
  }}
  width={screenWidth - 40}
  height={220}
  yAxisLabel=""
  yAxisSuffix="kg"
  chartConfig={chartConfig}
  style={styles.chart}
  verticalLabelRotation={30}
/>

                </View>
              )}

              {/* Distance Trend Line Chart */}
              {analyticsData.chartData.distances.length > 0 && (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Distance Trend</Text>
                  <LineChart
                    data={{
                      labels: analyticsData.chartData.labels,
                      datasets: [
                        {
                          data: analyticsData.chartData.distances,
                          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                          strokeWidth: 3,
                        },
                      ],
                    }}
                    width={screenWidth - 40}
                    height={220}
                    chartConfig={{
                      ...chartConfig,
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                    }}
                    style={styles.chart}
                    bezier
                  />
                </View>
              )}

              {/* Emission Distribution Pie Chart */}
              {analyticsData.pieData.length > 0 && (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>CO₂ Emission Distribution</Text>
                  <PieChart
                    data={analyticsData.pieData}
                    width={screenWidth - 40}
                    height={220}
                    chartConfig={chartConfig}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    style={styles.chart}
                  />
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    opacity: 0.9,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  summaryCardUnit: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },
  chartsContainer: {
    paddingBottom: 40,
  },
  chartContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
  },
});
