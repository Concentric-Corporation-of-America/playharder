import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "PlayHarder Golf <shipping@playharder.golf>";

interface EmailRequest {
  to: string;
  template: "order_confirmation" | "shipment_picked_up" | "out_for_delivery" | "delivered" | "shipment_exception";
  data: {
    customerName: string;
    orderNumber?: string;
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: string;
    deliveryAddress?: string;
    items?: Array<{ name: string; quantity: number }>;
    exceptionMessage?: string;
    trackingUrl?: string;
  };
}

const getEmailTemplate = (template: string, data: EmailRequest["data"]) => {
  const baseStyles = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #0a0a0a; }
      .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; }
      .header { background: linear-gradient(90deg, #00ff87 0%, #60efff 100%); padding: 30px; text-align: center; }
      .header h1 { color: #0a0a0a; margin: 0; font-size: 28px; font-weight: 800; }
      .header .logo { font-size: 48px; margin-bottom: 10px; }
      .content { padding: 40px 30px; color: #ffffff; }
      .content h2 { color: #00ff87; margin-top: 0; font-size: 24px; }
      .content p { line-height: 1.8; color: #b0b0b0; font-size: 16px; }
      .highlight { color: #60efff; font-weight: 600; }
      .tracking-box { background: rgba(0, 255, 135, 0.1); border: 2px solid #00ff87; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
      .tracking-number { font-size: 24px; font-weight: 800; color: #00ff87; letter-spacing: 2px; }
      .btn { display: inline-block; background: linear-gradient(90deg, #00ff87 0%, #60efff 100%); color: #0a0a0a; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; margin: 20px 0; }
      .btn:hover { opacity: 0.9; }
      .status-icon { font-size: 64px; margin-bottom: 20px; }
      .items-list { background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 15px; margin: 15px 0; }
      .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
      .item:last-child { border-bottom: none; }
      .footer { background: #0a0a0a; padding: 30px; text-align: center; color: #666; font-size: 12px; }
      .footer a { color: #00ff87; text-decoration: none; }
      .delivery-info { background: rgba(96, 239, 255, 0.1); border-radius: 8px; padding: 15px; margin: 15px 0; }
      .exception-box { background: rgba(255, 87, 87, 0.1); border: 2px solid #ff5757; border-radius: 12px; padding: 20px; margin: 20px 0; }
      .exception-icon { color: #ff5757; }
    </style>
  `;

  const templates: Record<string, { subject: string; html: string }> = {
    order_confirmation: {
      subject: `Order Confirmed! #${data.orderNumber} - PlayHarder Golf`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">⛳</div>
              <h1>PlayHarder Golf</h1>
            </div>
            <div class="content">
              <div class="status-icon">✅</div>
              <h2>Order Confirmed!</h2>
              <p>Hey <span class="highlight">${data.customerName}</span>,</p>
              <p>Great news! Your order has been confirmed and we're getting it ready for shipment. Your golf gear is about to embark on its journey to you!</p>
              
              <div class="tracking-box">
                <p style="margin: 0; color: #b0b0b0;">Order Number</p>
                <div class="tracking-number">#${data.orderNumber}</div>
              </div>
              
              ${data.items ? `
                <div class="items-list">
                  <p style="color: #00ff87; margin-top: 0;"><strong>Items in your order:</strong></p>
                  ${data.items.map(item => `
                    <div class="item">
                      <span>${item.name}</span>
                      <span class="highlight">x${item.quantity}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              <div class="delivery-info">
                <p style="margin: 0;"><strong>Shipping to:</strong></p>
                <p style="margin: 5px 0; color: #60efff;">${data.deliveryAddress || 'Address on file'}</p>
                ${data.estimatedDelivery ? `<p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> <span class="highlight">${data.estimatedDelivery}</span></p>` : ''}
              </div>
              
              <p>We'll send you another email with tracking information once your order ships.</p>
              
              <center>
                <a href="https://playharder.vercel.app/dashboard" class="btn">View Order Status</a>
              </center>
            </div>
            <div class="footer">
              <p>PlayHarder Golf - Ship Your Game Further</p>
              <p><a href="https://playharder.vercel.app">playharder.golf</a> | <a href="mailto:support@playharder.golf">support@playharder.golf</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    shipment_picked_up: {
      subject: `Your Order is On Its Way! - PlayHarder Golf`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">⛳</div>
              <h1>PlayHarder Golf</h1>
            </div>
            <div class="content">
              <div class="status-icon">📦</div>
              <h2>Shipment Picked Up!</h2>
              <p>Hey <span class="highlight">${data.customerName}</span>,</p>
              <p>Your order has been picked up by <span class="highlight">${data.carrier || 'the carrier'}</span> and is now on its way to you!</p>
              
              <div class="tracking-box">
                <p style="margin: 0; color: #b0b0b0;">Tracking Number</p>
                <div class="tracking-number">${data.trackingNumber}</div>
              </div>
              
              <div class="delivery-info">
                <p style="margin: 0;"><strong>Carrier:</strong> <span class="highlight">${data.carrier}</span></p>
                ${data.estimatedDelivery ? `<p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> <span class="highlight">${data.estimatedDelivery}</span></p>` : ''}
              </div>
              
              <center>
                <a href="${data.trackingUrl || 'https://playharder.vercel.app/dashboard'}" class="btn">Track Your Package</a>
              </center>
            </div>
            <div class="footer">
              <p>PlayHarder Golf - Ship Your Game Further</p>
              <p><a href="https://playharder.vercel.app">playharder.golf</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    out_for_delivery: {
      subject: `Out for Delivery Today! - PlayHarder Golf`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">⛳</div>
              <h1>PlayHarder Golf</h1>
            </div>
            <div class="content">
              <div class="status-icon">🚚</div>
              <h2>Out for Delivery!</h2>
              <p>Hey <span class="highlight">${data.customerName}</span>,</p>
              <p>Exciting news! Your package is <span class="highlight">out for delivery today</span>! Make sure someone is available to receive it.</p>
              
              <div class="tracking-box">
                <p style="margin: 0; color: #b0b0b0;">Tracking Number</p>
                <div class="tracking-number">${data.trackingNumber}</div>
              </div>
              
              <div class="delivery-info">
                <p style="margin: 0;"><strong>Delivering to:</strong></p>
                <p style="margin: 5px 0; color: #60efff;">${data.deliveryAddress || 'Address on file'}</p>
              </div>
              
              <center>
                <a href="${data.trackingUrl || 'https://playharder.vercel.app/dashboard'}" class="btn">Track Live Location</a>
              </center>
            </div>
            <div class="footer">
              <p>PlayHarder Golf - Ship Your Game Further</p>
              <p><a href="https://playharder.vercel.app">playharder.golf</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    delivered: {
      subject: `Delivered! Your Golf Gear Has Arrived - PlayHarder Golf`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">⛳</div>
              <h1>PlayHarder Golf</h1>
            </div>
            <div class="content">
              <div class="status-icon">🎉</div>
              <h2>Package Delivered!</h2>
              <p>Hey <span class="highlight">${data.customerName}</span>,</p>
              <p>Your package has been <span class="highlight">successfully delivered</span>! Time to hit the course with your new gear!</p>
              
              <div class="tracking-box" style="border-color: #60efff; background: rgba(96, 239, 255, 0.1);">
                <p style="margin: 0; color: #60efff; font-size: 20px;">✓ Delivered</p>
                <p style="margin: 10px 0 0; color: #b0b0b0;">${data.trackingNumber}</p>
              </div>
              
              <p>We hope you love your purchase! If you have any questions or concerns, don't hesitate to reach out.</p>
              
              <center>
                <a href="https://playharder.vercel.app/dashboard" class="btn">Book a Return</a>
              </center>
            </div>
            <div class="footer">
              <p>PlayHarder Golf - Ship Your Game Further</p>
              <p><a href="https://playharder.vercel.app">playharder.golf</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    shipment_exception: {
      subject: `Delivery Update Required - PlayHarder Golf`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">⛳</div>
              <h1>PlayHarder Golf</h1>
            </div>
            <div class="content">
              <div class="status-icon exception-icon">⚠️</div>
              <h2>Delivery Update</h2>
              <p>Hey <span class="highlight">${data.customerName}</span>,</p>
              <p>We wanted to let you know about an update regarding your shipment.</p>
              
              <div class="exception-box">
                <p style="margin: 0; color: #ff5757;"><strong>Status Update:</strong></p>
                <p style="margin: 10px 0 0; color: #ffffff;">${data.exceptionMessage || 'There has been a delay with your shipment. We are working to resolve this as quickly as possible.'}</p>
              </div>
              
              <div class="tracking-box">
                <p style="margin: 0; color: #b0b0b0;">Tracking Number</p>
                <div class="tracking-number">${data.trackingNumber}</div>
              </div>
              
              <p>We're monitoring your shipment closely and will update you as soon as we have more information.</p>
              
              <center>
                <a href="${data.trackingUrl || 'https://playharder.vercel.app/dashboard'}" class="btn">Track Your Package</a>
              </center>
            </div>
            <div class="footer">
              <p>PlayHarder Golf - Ship Your Game Further</p>
              <p>Need help? <a href="mailto:support@playharder.golf">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    }
  };

  return templates[template] || templates.order_confirmation;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { to, template, data }: EmailRequest = await req.json();

    if (!to || !template || !data) {
      throw new Error("Missing required fields: to, template, data");
    }

    const emailContent = getEmailTemplate(template, data);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
