import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { MapPin, Navigation, Bike } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';
import { Order } from '@/context/CourierContext';
import { fetchRoute, Coordinate, RouteInfo } from '@/lib/routing';

interface OrderMapProps {
  order: Order;
  navigationMode?: boolean;
  onLocationUpdate?: (location: Location.LocationObject) => void;
  onRouteUpdate?: (routeInfo: RouteInfo) => void;
  recalculateTrigger?: number;
}

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export default function OrderMap({ order, navigationMode = false, onLocationUpdate, onRouteUpdate, recalculateTrigger }: OrderMapProps) {
  const { t } = useTranslation();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>(order.routeCoordinates);
  const mapRef = useRef<MapView>(null);

  // Calculate target location based on status
  const targetLocation = order.status === 'pickup' ? order.pickupLocation : order.dropoffLocation;

  // Watch position for real-time tracking
  useEffect(() => {
    let subscriber: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      // Initial location
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
      if (onLocationUpdate) onLocationUpdate(location);

      // Real-time updates
      subscriber = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000, // Update every 1 second for smoother marker
          distanceInterval: 1, // Update every 1 meter
        },
        (newLocation) => {
          setCurrentLocation(newLocation);
          if (onLocationUpdate) onLocationUpdate(newLocation);
        }
      );
    };

    startTracking();

    return () => {
      if (subscriber) {
        subscriber.remove();
      }
    };
  }, []);

  // Recalculate route when location changes significantly (only in navigation mode)
  useEffect(() => {
    if (!navigationMode || !currentLocation) return;

    const updateRoute = async () => {
      const start: Coordinate = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      
      const routeInfo = await fetchRoute(start, targetLocation);
      if (routeInfo.coordinates.length > 0) {
        setRouteCoordinates(routeInfo.coordinates);
        if (onRouteUpdate) onRouteUpdate(routeInfo);
      }
    };

    updateRoute();
  }, [navigationMode, currentLocation?.coords.latitude, currentLocation?.coords.longitude, targetLocation.latitude, targetLocation.longitude, recalculateTrigger]);

  // Initial route for non-navigation mode (static preview)
  useEffect(() => {
    if (!navigationMode) {
      const loadStaticRoute = async () => {
        const routeInfo = await fetchRoute(order.pickupLocation, order.dropoffLocation);
        if (routeInfo.coordinates.length > 0) {
          setRouteCoordinates(routeInfo.coordinates);
          if (onRouteUpdate) onRouteUpdate(routeInfo);
        }
      };
      loadStaticRoute();
    }
  }, [navigationMode, order.pickupLocation, order.dropoffLocation]);

  const getInitialRegion = (): Region | undefined => {
    if (!order) return undefined;
    
    // If navigation mode, center on user or midpoint
    if (navigationMode && currentLocation) {
      return {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // Default: Center on pickup
    const { latitude, longitude } = order.pickupLocation;
    return {
      latitude,
      longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  };

  // Fit bounds when route changes
  useEffect(() => {
    if (mapRef.current && routeCoordinates.length > 0 && !navigationMode) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }
  }, [routeCoordinates, navigationMode]);

  // Camera following user in navigation mode
  useEffect(() => {
    if (navigationMode && currentLocation && mapRef.current) {
        // We can use animateCamera to pitch and follow
        mapRef.current.animateCamera({
            center: {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            },
            pitch: 45,
            heading: currentLocation.coords.heading || 0,
            zoom: 18,
        }, { duration: 1000 });
    }
  }, [navigationMode, currentLocation]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      initialRegion={getInitialRegion()}
      scrollEnabled={true}
      zoomEnabled={true}
      rotateEnabled={false}
      showsUserLocation={true} 
      showsMyLocationButton={true}
    >
      {currentLocation && (
        <Marker
          coordinate={{
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          }}
          title={t('order_detail.your_location')}
          description={t('order_detail.you_are_here')}
          rotation={currentLocation.coords.heading || 0}
          flat={true} // Improves rotation performance
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.markerContainer, { backgroundColor: Colors.secondary }]}>
            <Bike size={20} color="white" />
          </View>
        </Marker>
      )}

      <Marker 
        coordinate={order.pickupLocation}
        title={order.restaurantName}
        description={t('order_detail.pickup_label')}
        pinColor={Colors.primary}
      >
        <View style={[styles.markerContainer, { backgroundColor: Colors.primary }]}>
          <MapPin size={16} color="white" />
        </View>
      </Marker>

      <Marker 
        coordinate={order.dropoffLocation}
        title={order.customerName}
        description={t('order_detail.dropoff_label')}
        pinColor={Colors.accent}
      >
        <View style={[styles.markerContainer, { backgroundColor: Colors.accent }]}>
          <Navigation size={16} color="white" />
        </View>
      </Marker>

      <Polyline
        coordinates={routeCoordinates}
        strokeColor={Colors.primary}
        strokeWidth={5}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
