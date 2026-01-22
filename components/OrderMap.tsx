import React, { createElement, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
// @ts-ignore
import { Order } from '@/context/CourierContext';
import Colors from '@/constants/colors';
import { fetchRoute, Coordinate, RouteInfo } from '@/lib/routing';
import * as Location from 'expo-location';

interface OrderMapProps {
  order: Order;
  navigationMode?: boolean;
  onLocationUpdate?: (location: Location.LocationObject) => void;
  onRouteUpdate?: (routeInfo: RouteInfo) => void;
  recalculateTrigger?: number;
}

export default function OrderMap({ order, navigationMode = false }: OrderMapProps) {
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);

  // Derive pickup and dropoff locations from the new Order structure
  const pickupLocation = useMemo(() => ({
    latitude: order.restaurant.latitude,
    longitude: order.restaurant.longitude,
  }), [order.restaurant.latitude, order.restaurant.longitude]);

  const dropoffLocation = useMemo(() => ({
    latitude: order.deliveryAddress.latitude,
    longitude: order.deliveryAddress.longitude,
  }), [order.deliveryAddress.latitude, order.deliveryAddress.longitude]);

  useEffect(() => {
    let mounted = true;
    const loadRoute = async () => {
        const routeInfo = await fetchRoute(pickupLocation, dropoffLocation);
        if (mounted && routeInfo.coordinates.length > 0) {
            setRouteCoordinates(routeInfo.coordinates);
        }
    };
    loadRoute();
    return () => { mounted = false; };
  }, [pickupLocation, dropoffLocation]);

  // Safe guard for native - though this file should only be loaded on web
  if (Platform.OS !== 'web') {
     return (
        <View style={styles.container}>
            <Text>Web Map View Only</Text>
        </View>
     );
  }

  // Construct Leaflet Map HTML
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

          // Markers
          const pickupIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:${Colors.primary};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);'></div>",
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });

          const dropoffIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:${Colors.accent};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);'></div>",
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });

          L.marker(pickup).addTo(map)
            .bindPopup("<b>Pickup</b><br>${order.restaurant.name.replace(/'/g, "\\'")}");

          L.marker(dropoff).addTo(map)
            .bindPopup("<b>Dropoff</b><br>${order.customer.name.replace(/'/g, "\\'")}");

          // Route Polyline
          const polyline = L.polyline(route, { 
            color: '${Colors.primary}', 
            weight: 4,
            opacity: 0.8,
            lineCap: 'round'
          }).addTo(map);
          
          // Fit bounds
          const bounds = L.latLngBounds([pickup, dropoff, ...route]);
          map.fitBounds(bounds, { padding: [40, 40] });

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
        title: "Order Route Map"
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
