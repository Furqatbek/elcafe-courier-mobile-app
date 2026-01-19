import { z } from "zod";
import { publicProcedure } from "../../create-context";

/**
 * Start navigation for an order
 *
 * In production, this should:
 * 1. Validate the courier is assigned to this order
 * 2. Update order status to indicate navigation has started
 * 3. Notify the customer that the courier is on the way
 * 4. Start tracking the courier's location more frequently
 * 5. Calculate and store the initial ETA
 * 6. Log the navigation start event for analytics
 */
export const startNavigation = publicProcedure
  .input(
    z.object({
      orderId: z.string().min(1),
      destinationType: z.enum(["pickup", "dropoff"]).optional().default("pickup"),
      estimatedDuration: z.number().optional(), // in minutes
      estimatedDistance: z.number().optional(), // in meters
    })
  )
  .mutation(async ({ input, ctx }) => {
    // TODO: Get courier ID from authenticated context
    // const courierId = ctx.user?.id;

    // TODO: Verify order belongs to courier
    // const order = await db.orders.findUnique({
    //   where: { id: input.orderId, courierId }
    // });
    // if (!order) throw new Error("Order not found or not assigned to courier");

    // TODO: Update order status
    // await db.orders.update({
    //   where: { id: input.orderId },
    //   data: {
    //     status: input.destinationType === "pickup" ? "navigating_to_pickup" : "navigating_to_dropoff",
    //     navigationStartedAt: new Date(),
    //     estimatedArrival: input.estimatedDuration
    //       ? new Date(Date.now() + input.estimatedDuration * 60000)
    //       : undefined,
    //   }
    // });

    // TODO: Notify customer
    // await notificationService.send(order.customerId, {
    //   type: "courier_on_the_way",
    //   orderId: input.orderId,
    //   eta: input.estimatedDuration,
    // });

    console.log("Navigation started for order:", {
      orderId: input.orderId,
      destinationType: input.destinationType,
      estimatedDuration: input.estimatedDuration,
      estimatedDistance: input.estimatedDistance,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Navigation started",
      data: {
        orderId: input.orderId,
        navigationStartedAt: new Date().toISOString(),
      }
    };
  });
