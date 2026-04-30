// =========================
// IMPORTS
// =========================
import { router } from "./router.js";

// =========================
// MAIN FETCH HANDLER
// =========================
export default {
  async fetch(request, env, ctx) {

    try {

      // =========================
      // CORS (IMPORTANT FRONTEND)
      // =========================
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders()
        });
      }

      // =========================
      // ROUTER CALL
      // =========================
      const response = await router(request, env, ctx);

      // =========================
      // ADD CORS TO RESPONSE
      // =========================
      return addCors(response);

    } catch (err) {

      console.error("❌ Worker Error:", err);

      return new Response(JSON.stringify({
        success: false,
        error: "Internal Server Error"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders()
        }
      });
    }
  }
};

// =========================
// CORS HEADERS
// =========================
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

// =========================
// ADD CORS TO RESPONSE
// =========================
function addCors(response) {

  const newHeaders = new Headers(response.headers);

  Object.entries(corsHeaders()).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}