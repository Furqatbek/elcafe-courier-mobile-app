import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  showUserLocation?: boolean;
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

// 0/undefined/NaN coordinates mean "unknown" — never render a marker in the
// Gulf of Guinea or crash on undefined math.
function isValidCoordinate(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export default function OrderMap({
  order,
  navigationMode = false,
  showUserLocation = true,
  onLocationUpdate,
  onRouteUpdate,
  recalculateTrigger,
}: OrderMapProps) {
  const { t } = useTranslation();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const mapRef = useRef<MapView>(null);

  // Derive pickup/dropoff from the flat Order fields (restaurantLat/Lng,
  // deliveryLat/Lng) — mirrors OrderMap.tsx (web).
  const restaurantLat = order?.restaurantLat ?? 0;
  const restaurantLng = order?.restaurantLng ?? 0;
  const deliveryLat = order?.deliveryLat ?? 0;
  const deliveryLng = order?.deliveryLng ?? 0;
  const restaurantName = order?.restaurantName ?? 'Restaurant';
  const customerName = order?.customerName ?? 'Customer';

  const hasPickup = isValidCoordinate(restaurantLat, restaurantLng);
  const hasDropoff = isValidCoordinate(deliveryLat, deliveryLng);

  const pickupLocation = useMemo<Coordinate>(() => ({
    latitude: restaurantLat,
    longitude: restaurantLng,
  }), [restaurantLat, restaurantLng]);

  const dropoffLocation = useMemo<Coordinate>(() => ({
    latitude: deliveryLat,
    longitude: deliveryLng,
  }), [deliveryLat, deliveryLng]);

  // Determine destination based on order status in navigation mode
  const isGoingToPickup = order?.status === 'COURIER_ASSIGNED' || order?.status === 'READY';
  const targetLocation = isGoingToPickup ? pickupLocation : dropoffLocation;
  const hasTarget = isGoingToPickup ? hasPickup : hasDropoff;

  // Watch position for real-time tracking
  useEffect(() => {
    let subscriber: Location.LocationSubscription | null = null;
    let mounted = true;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permission to access location was denied');
          return;
        }

        // Initial location
        const location = await Location.getCurrentPositionAsync({});
        if (mounted) {
          setCurrentLocation(location);
          onLocationUpdate?.(location);
        }

        // Real-time updates
        subscriber = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000, // Update every 1 second for smoother marker
            distanceInterval: 1, // Update every 1 meter
          },
          (newLocation) => {
            if (mounted) {
              setCurrentLocation(newLocation);
              onLocationUpdate?.(newLocation);
            }
          }
        );
      } catch (error) {
        console.error('[OrderMap] Error starting location tracking:', error);
      }
    };

    startTracking();

    return () => {
      mounted = false;
      if (subscriber) {
        subscriber.remove();
      }
    };
  }, []);

  // Recalculate route when location changes significantly (only in navigation mode)
  useEffect(() => {
    if (!navigationMode || !currentLocation || !hasTarget) return;

    let mounted = true;
    const updateRoute = async () => {
      const start: Coordinate = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      const routeInfo = await fetchRoute(start, targetLocation);
      if (mounted && routeInfo && routeInfo.coordinates.length > 0) {
        setRouteCoordinates(routeInfo.coordinates);
        onRouteUpdate?.(routeInfo);
      }
    };

    updateRoute();
    return () => { mounted = false; };
  }, [navigationMode, currentLocation?.coords.latitude, currentLocation?.coords.longitude, hasTarget, targetLocation.latitude, targetLocation.longitude, recalculateTrigger]);

  // Initial route for non-navigation mode (static preview)
  useEffect(() => {
    if (navigationMode || !hasPickup || !hasDropoff) return;

    let mounted = true;
    const loadStaticRoute = async () => {
      const routeInfo = await fetchRoute(pickupLocation, dropoffLocation);
      if (mounted && routeInfo && routeInfo.coordinates.length > 0) {
        setRouteCoordinates(routeInfo.coordinates);
        onRouteUpdate?.(routeInfo);
      }
    };
    loadStaticRoute();
    return () => { mounted = false; };
  }, [navigationMode, hasPickup, hasDropoff, pickupLocation, dropoffLocation]);

  const getInitialRegion = (): Region | undefined => {
    // If navigation mode, center on user
    if (navigationMode && currentLocation) {
      return {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // Default: center on pickup, then dropoff, then user location
    const center = hasPickup
      ? pickupLocation
      : hasDropoff
        ? dropoffLocation
        : currentLocation
          ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }
          : null;

    if (!center) return undefined;

    return {
      latitude: center.latitude,
      longitude: center.longitude,
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

  // Fit bounds to the known markers when there is no route line to fit to
  useEffect(() => {
    if (navigationMode || routeCoordinates.length > 0 || !mapRef.current) return;

    const points: Coordinate[] = [];
    if (hasPickup) points.push(pickupLocation);
    if (hasDropoff) points.push(dropoffLocation);
    if (points.length < 2) return;

    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
      animated: true,
    });
  }, [navigationMode, routeCoordinates.length, hasPickup, hasDropoff, pickupLocation, dropoffLocation]);

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
      showsUserLocation={showUserLocation}
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

      {hasPickup && (
        <Marker
          coordinate={pickupLocation}
          title={restaurantName}
          description={t('order_detail.pickup_label')}
          pinColor={Colors.primary}
        >
          <View style={[styles.markerContainer, { backgroundColor: Colors.primary }]}>
            <MapPin size={16} color="white" />
          </View>
        </Marker>
      )}

      {hasDropoff && (
        <Marker
          coordinate={dropoffLocation}
          title={customerName}
          description={t('order_detail.dropoff_label')}
          pinColor={Colors.accent}
        >
          <View style={[styles.markerContainer, { backgroundColor: Colors.accent }]}>
            <Navigation size={16} color="white" />
          </View>
        </Marker>
      )}

      {routeCoordinates.length > 0 && (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor={Colors.primary}
          strokeWidth={5}
        />
      )}
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
