import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});


app.post("/api/v1/auth/login", async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  // Simple validation (accept any login for demo purposes, or check specifically for the user's requested creds)
  if (email && password) {
      return c.json({
        success: true,
        message: "Login successful",
        data: {
            accessToken: "eyJhbGciOiJIUzUxMiJ9.mock_token",
            refreshToken: "eyJhbGciOiJIUzUxMiJ9.mock_refresh_token",
            tokenType: "Bearer",
            user: {
                id: 1,
                email: email,
                firstName: "Admin",
                lastName: "User",
                phone: null,
                role: "ADMIN",
                active: true,
                emailVerified: true,
                createdAt: new Date().toISOString()
            }
        },
        timestamp: new Date().toISOString()
    });
  }

  return c.json({
      success: false,
      message: "Invalid credentials"
  }, 401);
});

export default app;
