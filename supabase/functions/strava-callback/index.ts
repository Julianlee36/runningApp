import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for preflight requests and error responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
};

serve(async (req) => {
  // Handle preflight requests for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state"); // Get user ID from state

    if (!code) {
      throw new Error("No Strava authorization code provided.");
    }
    if (!userId) {
      throw new Error("No user ID provided in state.");
    }

    // Exchange the code for an access token from Strava
    const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
    const stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(`Strava token exchange failed: ${errorBody}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_at, athlete } = tokenData;

    // Create a Supabase admin client to securely update the user's data
    const supabaseAdmin = createClient(
      Deno.env.get("VITE_SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    // Update the user's record in the database
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        strava_access_token: access_token,
        strava_refresh_token: refresh_token,
        strava_token_expires_at: new Date(expires_at * 1000).toISOString(),
        strava_athlete_id: athlete.id,
        strava_scope: tokenData.scope?.split(','),
      })
      .eq("id", userId);

    if (updateError) {
      throw updateError;
    }

    // Redirect the user back to their dashboard
    const redirectUrl = "https://running-app-one.vercel.app/dashboard?strava_success=true";
    return Response.redirect(redirectUrl);

  } catch (error) {
    console.error("Strava Callback Error:", error.message);
    // Redirect to dashboard with an error
    const redirectUrl = "https://running-app-one.vercel.app/dashboard?error=strava_connection_failed";
    return Response.redirect(redirectUrl);
  }
}); 