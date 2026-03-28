import { z } from "zod";
import { publicProcedure } from "../../create-context";

export const arrived = publicProcedure
  .input(
    z.object({
      orderId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log("Courier arrived for order:", input.orderId);
    return { success: true };
  });
