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
    // 1. Get the authorization code from the request URL
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Supabase client adds this

    if (!code) {
      throw new Error("No authorization code provided.");
    }

    // The state parameter should contain the user's session.
    // We can parse it to get the user ID.
    // This is a simplified approach; a real app might use a more robust method.
    const decodedState = JSON.parse(atob(state || "{}"));
    const userId = decodedState.user?.id;
    if (!userId) {
      // For some reason, Supabase redirect doesn't always include user in state.
      // As a fallback, we assume the user is the one who initiated this.
      // This part might need to be more secure in a multi-user production app.
      console.warn("User ID not found in state, proceeding without it for now.");
    }

    // 2. Exchange the code for an access token from Strava
    const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
    const stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    const {
      access_token,
      refresh_token,
      expires_at,
      athlete,
    } = tokenData;

    // 3. Create a Supabase client with the service role key to update user data
    const supabaseAdmin = createClient(
      Deno.env.get("VITE_SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Update the user's record in the database with the new Strava data
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        strava_access_token: access_token, // Should be encrypted
        strava_refresh_token: refresh_token, // Should be encrypted
        strava_token_expires_at: new Date(expires_at * 1000).toISOString(),
        strava_athlete_id: athlete.id,
        strava_scope: tokenData.scope.split(','),
      })
      .eq("id", userId); // This is the crucial part that links to the correct user

    if (updateError) {
      throw updateError;
    }

    // 5. Redirect the user back to their dashboard
    const redirectUrl = new URL("/dashboard", url.origin).toString();
    return Response.redirect(redirectUrl);

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 