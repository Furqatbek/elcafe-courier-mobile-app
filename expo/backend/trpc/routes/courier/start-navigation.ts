import { z } from "zod";
import { publicProcedure } from "../../create-context";

export const startNavigation = publicProcedure
  .input(
    z.object({
      orderId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log("Navigation started for order:", input.orderId);
    return { success: true };
  });
