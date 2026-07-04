import React, { createElement, useEffect, useState, useMemo, useRef } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
// @ts-ignore
import { Order } from '@/context/CourierContext';
import Colors from '@/constants/colors';
import { fetchRoute, Coordinate, RouteInfo } from '@/lib/routing';
import * as Location from 'expo-location';

interface OrderMapProps {
  order: Order;
  navigationMode?: boolean;
  showUserLocation?: boolean;
  onLocationUpdate?: (location: Location.LocationObject) => void;
  onRouteUpdate?: (routeInfo: RouteInfo) => void;
  recalculateTrigger?: number;
}

export default function OrderMap({
  order,
  navigationMode = false,
  showUserLocation = false,
  onLocationUpdate,
  onRouteUpdate,
  recalculateTrigger,
}: OrderMapProps) {
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Support both flat (new backend) and nested (old interface) field names
  const restaurantLat = order.restaurantLat ?? order.restaurant?.latitude ?? 0;
  const restaurantLng = order.restaurantLng ?? order.restaurant?.longitude ?? 0;
  const deliveryLat = order.deliveryLat ?? order.deliveryAddress?.latitude ?? 0;
  const deliveryLng = order.deliveryLng ?? order.deliveryAddress?.longitude ?? 0;
  const restaurantName = order.restaurantName ?? order.restaurant?.name ?? 'Restaurant';
  const customerName = order.customerName ?? order.customer?.name ?? 'Customer';

  // Derive pickup and dropoff locations
  const pickupLocation = useMemo(() => ({
    latitude: restaurantLat,
    longitude: restaurantLng,
  }), [restaurantLat, restaurantLng]);

  const dropoffLocation = useMemo(() => ({
    latitude: deliveryLat,
    longitude: deliveryLng,
  }), [deliveryLat, deliveryLng]);

  // Determine destination based on order status in navigation mode
  const isGoingToPickup = order.status === 'COURIER_ASSIGNED' || order.status === 'READY';
  const destination = isGoingToPickup ? pickupLocation : dropoffLocation;

  // Get user location
  useEffect(() => {
    if (!showUserLocation) return;

    let mounted = true;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied');
          return;
        }

        // Get initial location
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (mounted) {
          setUserLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
          onLocationUpdate?.(currentLocation);
        }

        // Watch for location updates
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 10,
          },
          (location) => {
            if (mounted) {
              setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              onLocationUpdate?.(location);
            }
          }
        );
      } catch (error) {
        console.error('Error getting location:', error);
      }
    };

    startLocationTracking();

    return () => {
      mounted = false;
      // On web, the remove() method may not exist or work properly
      if (locationSubscription.current) {
        try {
          if (typeof locationSubscription.current.remove === 'function') {
            locationSubscription.current.remove();
          }
        } catch (e) {
          // Ignore errors on web when cleaning up location subscription
          console.log('[OrderMap] Location cleanup error (expected on web):', e);
        }
        locationSubscription.current = null;
      }
    };
  }, [showUserLocation]);

  // Fetch route - in navigation mode, route from user to destination
  useEffect(() => {
    let mounted = true;
    const loadRoute = async () => {
      let routeInfo: RouteInfo;

      if (navigationMode && userLocation) {
        // Navigation mode: route from user location to destination
        routeInfo = await fetchRoute(userLocation, destination);
      } else {
        // Preview mode: route from pickup to dropoff
        routeInfo = await fetchRoute(pickupLocation, dropoffLocation);
      }

      if (mounted && routeInfo.coordinates.length > 0) {
        setRouteCoordinates(routeInfo.coordinates);
        onRouteUpdate?.(routeInfo);
      }
    };
    loadRoute();
    return () => { mounted = false; };
  }, [pickupLocation, dropoffLocation, userLocation, navigationMode, destination, recalculateTrigger, order.status]);

  // Safe guard for native - though this file should only be loaded on web
  if (Platform.OS !== 'web') {
     return (
        <View style={styles.container}>
            <Text>Web Map View Only</Text>
        </View>
     );
  }

  // Construct Leaflet Map HTML with navigation route
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
        <style>
          body { margin: 0; padding: 0; background-color: #E2E8F0; }
          #map { height: 100vh; width: 100vw; }
          .custom-popup .leaflet-popup-content-wrapper {
            border-radius: 8px;
            padding: 0;
          }
          .user-marker {
            background-color: #4285F4;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 8px rgba(66, 133, 244, 0.6);
            animation: pulse 2s infinite;
          }
          .user-marker::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
          }
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.6); }
            70% { box-shadow: 0 0 0 20px rgba(66, 133, 244, 0); }
            100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); }
          }
          .destination-marker {
            background-color: ${navigationMode && isGoingToPickup ? Colors.primary : Colors.accent};
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .destination-marker::after {
            content: '${navigationMode && isGoingToPickup ? 'A' : 'B'}';
            transform: rotate(45deg);
            color: white;
            font-weight: bold;
            font-size: 14px;
          }
          .secondary-marker {
            background-color: ${navigationMode && isGoingToPickup ? Colors.accent : Colors.primary};
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 4px rgba(0,0,0,0.3);
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // Initialize map
          const map = L.map('map', { zoomControl: false });

          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          // Data
          const pickup = [${pickupLocation.latitude}, ${pickupLocation.longitude}];
          const dropoff = [${dropoffLocation.latitude}, ${dropoffLocation.longitude}];
          const route = ${JSON.stringify(routeCoordinates.map(c => [c.latitude, c.longitude]))};
          const userLoc = ${userLocation ? `[${userLocation.latitude}, ${userLocation.longitude}]` : 'null'};
          const navigationMode = ${navigationMode};
          const isGoingToPickup = ${isGoingToPickup};

          // User location marker (courier)
          const userIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div class='user-marker'></div>",
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          // Destination marker (where courier is heading)
          const destinationIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div class='destination-marker'></div>",
            iconSize: [32, 32],
            iconAnchor: [16, 32]
          });

          // Secondary marker (the other point)
          const secondaryIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div class='secondary-marker'></div>",
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          if (navigationMode && userLoc) {
            // Navigation mode: show user, destination, and secondary point

            // User marker
            L.marker(userLoc, { icon: userIcon, zIndexOffset: 1000 }).addTo(map)
              .bindPopup("<b>You</b>");

            // Current destination (pickup or dropoff)
            const destPoint = isGoingToPickup ? pickup : dropoff;
            const destName = isGoingToPickup ? "${restaurantName.replace(/'/g, "\\'")}" : "${customerName.replace(/'/g, "\\'")}";
            L.marker(destPoint, { icon: destinationIcon, zIndexOffset: 500 }).addTo(map)
              .bindPopup("<b>" + (isGoingToPickup ? "Pickup" : "Dropoff") + "</b><br>" + destName);

            // Secondary point (shown smaller)
            const secPoint = isGoingToPickup ? dropoff : pickup;
            const secName = isGoingToPickup ? "${customerName.replace(/'/g, "\\'")}" : "${restaurantName.replace(/'/g, "\\'")}";
            L.marker(secPoint, { icon: secondaryIcon }).addTo(map)
              .bindPopup("<b>" + (isGoingToPickup ? "Dropoff" : "Pickup") + "</b><br>" + secName);

            // Route from user to destination
            if (route.length > 0) {
              L.polyline(route, {
                color: '${Colors.primary}',
                weight: 5,
                opacity: 0.9,
                lineCap: 'round'
              }).addTo(map);
            }

            // Fit bounds to show user and destination
            const boundsPoints = [userLoc, destPoint];
            if (route.length > 0) boundsPoints.push(...route);
            const bounds = L.latLngBounds(boundsPoints);
            map.fitBounds(bounds, { padding: [60, 60] });

          } else {
            // Preview mode: show pickup, dropoff, and optional user location

            const pickupIcon = L.divIcon({
              className: 'custom-div-icon',
              html: "<div style='background-color:${Colors.primary};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);'></div>",
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });

            const dropoffIcon = L.divIcon({
              className: 'custom-div-icon',
              html: "<div style='background-color:${Colors.accent};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);'></div>",
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });

            L.marker(pickup, { icon: pickupIcon }).addTo(map)
              .bindPopup("<b>Pickup</b><br>${restaurantName.replace(/'/g, "\\'")}");

            L.marker(dropoff, { icon: dropoffIcon }).addTo(map)
              .bindPopup("<b>Dropoff</b><br>${customerName.replace(/'/g, "\\'")}");

            // User location if available
            if (userLoc) {
              L.marker(userLoc, { icon: userIcon, zIndexOffset: 1000 }).addTo(map)
                .bindPopup("<b>You</b>");
            }

            // Route from pickup to dropoff
            if (route.length > 0) {
              L.polyline(route, {
                color: '${Colors.primary}',
                weight: 4,
                opacity: 0.8,
                lineCap: 'round'
              }).addTo(map);
            }

            // Fit bounds
            const boundsPoints = [pickup, dropoff, ...route];
            if (userLoc) boundsPoints.push(userLoc);
            const bounds = L.latLngBounds(boundsPoints);
            map.fitBounds(bounds, { padding: [40, 40] });
          }

          // Force resize to ensure correct rendering
          setTimeout(() => { map.invalidateSize(); }, 100);
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {createElement('iframe', {
        srcDoc: html,
        style: { width: '100%', height: '100%', border: 'none' },
        title: "Order Route Map",
        key: `${userLocation?.latitude}-${userLocation?.longitude}-${order.status}-${recalculateTrigger}`
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
});
