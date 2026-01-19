import { z } from "zod";
import { publicProcedure } from "../../create-context";

/**
 * Mark courier as arrived at destination
 *
 * In production, this should:
 * 1. Validate the courier is assigned to this order
 * 2. Verify the courier is within acceptable proximity to the destination
 * 3. Update order status appropriately (at_pickup or at_dropoff)
 * 4. Notify relevant parties (restaurant for pickup, customer for dropoff)
 * 5. Start a timer for waiting time tracking
 * 6. Log the arrival event for analytics and potential wait-time compensation
 */
export const arrived = publicProcedure
  .input(
    z.object({
      orderId: z.string().min(1),
      locationType: z.enum(["pickup", "dropoff"]).optional().default("pickup"),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // TODO: Get courier ID from authenticated context
    // const courierId = ctx.user?.id;

    // TODO: Verify order belongs to courier
    // const order = await db.orders.findUnique({
    //   where: { id: input.orderId, courierId },
    //   include: { pickupLocation: true, dropoffLocation: true }
    // });
    // if (!order) throw new Error("Order not found or not assigned to courier");

    // TODO: Verify proximity (optional but recommended)
    // const targetLocation = input.locationType === "pickup"
    //   ? order.pickupLocation
    //   : order.dropoffLocation;
    // const distance = calculateDistance(
    //   { lat: input.latitude, lng: input.longitude },
    //   { lat: targetLocation.latitude, lng: targetLocation.longitude }
    // );
    // const MAX_ARRIVAL_DISTANCE = 100; // meters
    // if (distance > MAX_ARRIVAL_DISTANCE) {
    //   throw new Error("Courier is too far from destination");
    // }

    // TODO: Update order status
    // const newStatus = input.locationType === "pickup" ? "at_pickup" : "at_dropoff";
    // await db.orders.update({
    //   where: { id: input.orderId },
    //   data: {
    //     status: newStatus,
    //     [input.locationType === "pickup" ? "arrivedAtPickupAt" : "arrivedAtDropoffAt"]: new Date(),
    //   }
    // });

    // TODO: Notify relevant party
    // if (input.locationType === "pickup") {
    //   await notificationService.send(order.restaurantId, {
    //     type: "courier_arrived_for_pickup",
    //     orderId: input.orderId,
    //   });
    // } else {
    //   await notificationService.send(order.customerId, {
    //     type: "courier_arrived",
    //     orderId: input.orderId,
    //   });
    // }

    console.log("Courier arrived for order:", {
      orderId: input.orderId,
      locationType: input.locationType,
      coordinates: input.latitude && input.longitude
        ? { lat: input.latitude, lng: input.longitude }
        : "not provided",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Arrived at ${input.locationType} location`,
      data: {
        orderId: input.orderId,
        arrivedAt: new Date().toISOString(),
        locationType: input.locationType,
      }
    };
  });
