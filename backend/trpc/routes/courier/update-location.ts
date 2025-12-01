import { z } from "zod";
import { publicProcedure } from "../../create-context";

export const updateLocation = publicProcedure
  .input(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    // In a real app, we would save this to a database or broadcast via WebSocket
    console.log("Courier location updated:", input);
    return { success: true };
  });
