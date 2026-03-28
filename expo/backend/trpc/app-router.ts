import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { updateLocation } from "./routes/courier/update-location";
import { startNavigation } from "./routes/courier/start-navigation";
import { arrived } from "./routes/courier/arrived";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  courier: createTRPCRouter({
    updateLocation,
    startNavigation,
    arrived,
  }),
});

export type AppRouter = typeof appRouter;
