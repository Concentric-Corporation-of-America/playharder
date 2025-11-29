import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHIPPO_WEBHOOK_SECRET = Deno.env.get("SHIPPO_WEBHOOK_SECRET");

interface ShippoWebhookEvent {
  event: string;
  data: {
    tracking_number: string;
    carrier: string;
    tracking_status: {
      status: string;
      status_details: string;
      status_date: string;
      location?: {
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
      };
    };
    eta?: string;
    original_eta?: string;
    servicelevel?: {
      name: string;
    };
    messages?: string[];
  };
}

const statusToTemplate: Record<string, string> = {
  PRE_TRANSIT: "order_confirmation",
  TRANSIT: "shipment_picked_up",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  FAILURE: "shipment_exception",
  RETURNED: "shipment_exception",
  UNKNOWN: "shipment_exception",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify webhook signature if secret is configured
    if (SHIPPO_WEBHOOK_SECRET) {
      const signature = req.headers.get("shippo-api-signature");
      // In production, verify the signature here
      // For now, we'll just check if it exists
      if (!signature) {
        console.warn("Missing webhook signature");
      }
    }

    const event: ShippoWebhookEvent = await req.json();
    console.log("Received Shippo webhook:", JSON.stringify(event, null, 2));

    const { tracking_number, carrier, tracking_status, eta } = event.data;

    // Find the shipment by tracking number
    const { data: shipment, error: shipmentError } = await supabase
      .from("dropship_shipments")
      .select(`
        id,
        order_id,
        tenant_id,
        dropship_orders!inner (
          id,
          customer_id,
          dropship_customers!inner (
            id,
            user_id,
            email,
            first_name,
            last_name
          )
        )
      `)
      .eq("tracking_number", tracking_number)
      .single();

    if (shipmentError || !shipment) {
      console.error("Shipment not found:", tracking_number);
      return new Response(
        JSON.stringify({ success: false, error: "Shipment not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const order = shipment.dropship_orders;
    const customer = order.dropship_customers;

    // Map Shippo status to our status
    const statusMap: Record<string, string> = {
      PRE_TRANSIT: "label_created",
      TRANSIT: "in_transit",
      OUT_FOR_DELIVERY: "out_for_delivery",
      DELIVERED: "delivered",
      FAILURE: "exception",
      RETURNED: "returned",
      UNKNOWN: "unknown",
    };

    const newStatus = statusMap[tracking_status.status] || "unknown";

    // Update shipment status
    const { error: updateError } = await supabase
      .from("dropship_shipments")
      .update({
        status: newStatus,
        estimated_delivery: eta || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipment.id);

    if (updateError) {
      console.error("Error updating shipment:", updateError);
    }

    // Store tracking event
    const locationString = tracking_status.location
      ? [
          tracking_status.location.city,
          tracking_status.location.state,
          tracking_status.location.zip,
          tracking_status.location.country,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

    const { error: eventError } = await supabase.from("tracking_events").insert({
      shipment_id: shipment.id,
      tenant_id: shipment.tenant_id,
      tracking_number,
      status: tracking_status.status,
      status_details: tracking_status.status_details,
      location: locationString,
      carrier,
      event_time: tracking_status.status_date,
      raw_data: event.data,
    });

    if (eventError) {
      console.error("Error storing tracking event:", eventError);
    }

    // Create in-app notification
    const notificationTitles: Record<string, string> = {
      PRE_TRANSIT: "Order Confirmed",
      TRANSIT: "Package Shipped",
      OUT_FOR_DELIVERY: "Out for Delivery",
      DELIVERED: "Package Delivered",
      FAILURE: "Delivery Issue",
      RETURNED: "Package Returned",
      UNKNOWN: "Tracking Update",
    };

    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: customer.user_id,
      tenant_id: shipment.tenant_id,
      type: statusToTemplate[tracking_status.status] || "shipment_exception",
      title: notificationTitles[tracking_status.status] || "Tracking Update",
      message: tracking_status.status_details || `Your package status: ${tracking_status.status}`,
      data: {
        tracking_number,
        carrier,
        shipment_id: shipment.id,
        order_id: order.id,
        status: tracking_status.status,
        location: locationString,
        eta,
      },
    });

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
    }

    // Check user notification preferences
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", customer.user_id)
      .eq("tenant_id", shipment.tenant_id)
      .single();

    const shouldSendEmail = preferences?.email_enabled !== false && preferences?.shipment_updates !== false;

    // Send email notification
    if (shouldSendEmail && customer.email) {
      const template = statusToTemplate[tracking_status.status] || "shipment_exception";
      
      try {
        const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            to: customer.email,
            template,
            data: {
              customerName: `${customer.first_name} ${customer.last_name}`,
              trackingNumber: tracking_number,
              carrier,
              estimatedDelivery: eta,
              exceptionMessage: tracking_status.status === "FAILURE" ? tracking_status.status_details : undefined,
              trackingUrl: `https://track.goshippo.com/${tracking_number}`,
            },
          }),
        });

        const emailResult = await emailResponse.json();
        console.log("Email sent:", emailResult);

        // Log email
        await supabase.from("email_logs").insert({
          user_id: customer.user_id,
          tenant_id: shipment.tenant_id,
          to_email: customer.email,
          from_email: "PlayHarder Golf <shipping@playharder.golf>",
          subject: `Tracking Update - ${tracking_number}`,
          template,
          status: emailResult.success ? "sent" : "failed",
          resend_id: emailResult.messageId,
          error_message: emailResult.error,
          metadata: { tracking_number, carrier, status: tracking_status.status },
        });
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }
    }

    // Send push notification if enabled
    const shouldSendPush = preferences?.push_enabled !== false && preferences?.shipment_updates !== false;

    if (shouldSendPush) {
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", customer.user_id);

      if (subscriptions && subscriptions.length > 0) {
        // Push notifications would be sent here using web-push
        // This requires VAPID keys to be configured
        console.log(`Would send push to ${subscriptions.length} subscriptions`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        shipment_id: shipment.id,
        new_status: newStatus,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
