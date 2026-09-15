const DOKU_SANDBOX_URL = "https://api.doku.com/checkout/v1/payment";
const DOKU_PAYMENT_PATH = "/checkout/v1/payment";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  });
}

function corsResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

async function sha256Base64(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function hmacSha256Base64(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(text)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function createDokuSignature({
  clientId,
  secretKey,
  requestId,
  timestamp,
  target,
  body,
}) {
  const digest = await sha256Base64(body);

  const component =
    `Client-Id:${clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${timestamp}\n` +
    `Request-Target:${target}\n` +
    `Digest:${digest}`;

  const hmac = await hmacSha256Base64(secretKey, component);

  return {
    digest,
    signature: `HMACSHA256=${hmac}`,
  };
}

async function supabaseRequest(env, path, options = {}) {
  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  return data;
}

async function getOrder(env, orderId) {
  const rows = await supabaseRequest(
    env,
    `/rest/v1/orders?id=eq.${encodeURIComponent(
      orderId
    )}&select=id,restaurant_id,order_number,customer_name,customer_phone,total,status`
  );

  return rows?.[0] || null;
}

async function getOrderItems(env, orderId) {
  return await supabaseRequest(
    env,
    `/rest/v1/order_items?order_id=eq.${encodeURIComponent(
      orderId
    )}&select=id,menu_name,price,quantity,subtotal`
  );
}

async function createPaymentRecord(env, order) {
  const existing = await supabaseRequest(
    env,
    `/rest/v1/payments?order_id=eq.${encodeURIComponent(
      order.id
    )}&provider=eq.doku&select=id,status,provider_transaction_id,amount&order=created_at.desc&limit=1`
  );

  if (existing?.[0]) {
    return existing[0];
  }

  const rows = await supabaseRequest(env, "/rest/v1/payments", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify([
      {
        order_id: order.id,
                restaurant_id: order.restaurant_id,amount: Number(order.total),
        provider: "doku",
        status: "pending",
      },
    ]),
  });

  return rows?.[0] || null;
}
async function updatePayment(env, paymentId, values) {
  await supabaseRequest(
    env,
    `/rest/v1/payments?id=eq.${encodeURIComponent(paymentId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify(values),
    }
  );
}

async function createDokuPayment(request, env) {
  const body = await request.json();
  const orderId = body?.order_id;

  if (!orderId) {
    return json(
      {
        success: false,
        message: "order_id wajib diisi.",
      },
      400
    );
  }

  const order = await getOrder(env, orderId);

  if (!order) {
    return json(
      {
        success: false,
        message: "Order tidak ditemukan.",
      },
      404
    );
  }

  if (order.status === "cancelled") {
    return json(
      {
        success: false,
        message: "Order sudah dibatalkan.",
      },
      400
    );
  }

  if (!Number.isFinite(Number(order.total)) || Number(order.total) <= 0) {
    return json(
      {
        success: false,
        message: "Total order tidak valid.",
      },
      400
    );
  }

  const items = await getOrderItems(env, order.id);

  const paymentRecord = await createPaymentRecord(env, order);

  if (!paymentRecord) {
    throw new Error("Gagal membuat record pembayaran.");
  }

  if (paymentRecord.status === "paid") {
    return json({
      success: true,
      paid: true,
      message: "Order sudah dibayar.",
    });
  }

  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const orderNumber = String(order.order_number ?? "").replace(/\D/g, "");

  const invoiceNumber = orderNumber
    ? `QRRESTO${orderNumber}`
    : `QRRESTO${order.id.replace(/-/g, "").slice(0, 24)}`;
  const origin = new URL(request.url).origin;

  const dokuPayload = {
    order: {
      amount: Number(order.total),
      invoice_number: invoiceNumber,
      currency: "IDR",
      callback_url: `${origin}/api/payment/result`,
      callback_url_result: `${origin}/api/payment/result`,
      auto_redirect: true,
      line_items: items.map((item) => ({
        id: item.id,
        name: item.menu_name,
        quantity: Number(item.quantity),
        price: Number(item.price),
      })),
    },
    payment: {
      payment_due_date: 60,
      type: "SALE",
      payment_method_types: ["QRIS"],
    },
  };

  const dokuBody = JSON.stringify(dokuPayload);

  const { digest, signature } = await createDokuSignature({
    clientId: env.DOKU_CLIENT_ID,
    secretKey: env.DOKU_SECRET_KEY,
    requestId,
    timestamp,
    target: DOKU_PAYMENT_PATH,
    body: dokuBody,
  });

  const dokuResponse = await fetch(DOKU_SANDBOX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": env.DOKU_CLIENT_ID,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      Digest: digest,
      Signature: signature,
    },
    body: dokuBody,
  });

  const dokuText = await dokuResponse.text();

  let dokuData;

  try {
    dokuData = dokuText ? JSON.parse(dokuText) : null;
  } catch {
    dokuData = {
      raw: dokuText,
    };
  }

  if (!dokuResponse.ok) {
    console.error("DOKU ERROR", dokuData);

    return json(
      {
        success: false,
        message: "DOKU menolak permintaan pembayaran.",
        detail: dokuData,
      },
      502
    );
  }

  const paymentUrl = dokuData?.response?.payment?.url;
  const tokenId = dokuData?.response?.payment?.token_id;

  if (!paymentUrl) {
    console.error("DOKU RESPONSE TANPA PAYMENT URL", dokuData);

    return json(
      {
        success: false,
        message: "DOKU tidak mengembalikan payment URL.",
      },
      502
    );
  }

  await updatePayment(env, paymentRecord.id, {
    payment_method: "QRIS",
    provider_transaction_id: tokenId || requestId,
    status: "pending",
  });

  return json({
    success: true,
    order_id: order.id,
    payment_id: paymentRecord.id,
    payment_url: paymentUrl,
  });
}

async function dokuNotification(request, env) {
  const body = await request.text();

  const clientId = request.headers.get("Client-Id");
  const requestId = request.headers.get("Request-Id");
  const timestamp = request.headers.get("Request-Timestamp");
  const receivedSignature = request.headers.get("Signature");

  if (!clientId || !requestId || !timestamp || !receivedSignature) {
    return json(
      {
        success: false,
        message: "Header DOKU tidak lengkap.",
      },
      400
    );
  }

  const { digest, signature } = await createDokuSignature({
    clientId,
    secretKey: env.DOKU_SECRET_KEY,
    requestId,
    timestamp,
    target: "/api/payment/notification",
    body,
  });

  if (signature !== receivedSignature) {
    return json(
      {
        success: false,
        message: "Signature DOKU tidak valid.",
      },
      401
    );
  }

  let notification;

  try {
    notification = JSON.parse(body);
  } catch {
    return json(
      {
        success: false,
        message: "Payload JSON tidak valid.",
      },
      400
    );
  }

  console.log("DOKU NOTIFICATION", notification);

  const invoiceNumber =
    notification?.order?.invoice_number ||
    notification?.order?.invoiceNumber ||
    notification?.invoice_number ||
    notification?.invoiceNumber;

  const transactionStatus =
    notification?.transaction?.status ||
    notification?.transaction?.transaction_status ||
    notification?.status ||
    notification?.transaction_status;

  const transactionId =
    notification?.transaction?.original_request_id ||
    notification?.transaction?.id ||
    notification?.transaction_id ||
    notification?.reference_number ||
    requestId;

  if (!invoiceNumber) {
    return json({
      success: true,
      message: "Notification diterima tetapi invoice tidak ditemukan.",
    });
  }

  const digits = String(invoiceNumber).replace(/\D/g, "");

  const orders = await supabaseRequest(
    env,
    `/rest/v1/orders?order_number=eq.${encodeURIComponent(
      digits
    )}&select=id,total,restaurant_id&limit=1`
  );

  const order = orders?.[0];

  if (!order) {
    return json({
      success: true,
      message: "Notification diterima tetapi order tidak ditemukan.",
    });
  }

  const normalizedStatus = String(transactionStatus || "").toUpperCase();

  const paid =
    normalizedStatus.includes("SUCCESS") ||
    normalizedStatus.includes("PAID") ||
    normalizedStatus.includes("COMPLETED");

  const paymentStatus = paid ? "paid" : "pending";

  const payments = await supabaseRequest(
    env,
    `/rest/v1/payments?order_id=eq.${encodeURIComponent(
      order.id
    )}&provider=eq.doku&select=id&order=created_at.desc&limit=1`
  );

  const payment = payments?.[0];

  if (payment) {
    await updatePayment(env, payment.id, {
      status: paymentStatus,
      provider_transaction_id: transactionId,
      ...(paid ? { paid_at: new Date().toISOString() } : {}),
    });
  }

  return json({
    success: true,
    message: "Notification DOKU berhasil diproses.",
  });
}

async function paymentResult(request) {
  const url = new URL(request.url);

  return new Response(
    `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pembayaran QR Resto</title>
<style>
body{
  font-family:Arial,sans-serif;
  display:flex;
  justify-content:center;
  align-items:center;
  min-height:100vh;
  margin:0;
  background:#f5f5f5;
}
.box{
  background:white;
  padding:32px;
  border-radius:16px;
  text-align:center;
  max-width:420px;
  margin:20px;
}
</style>
</head>
<body>
<div class="box">
<h2>Pembayaran Diproses</h2>
<p>Silakan kembali ke halaman QR Resto.</p>
<p>Status pembayaran akan diperbarui setelah menerima konfirmasi dari DOKU.</p>
</div>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
      },
    }
  );
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    try {
      if (
        request.method === "POST" &&
        url.pathname === "/api/payment/create"
      ) {
        return corsResponse(await createDokuPayment(request, env));
      }  if (
    request.method === "GET" &&
    url.pathname === "/api/payment/notification"
  ) {
    return json({
      success: true,
      message: "QR Resto DOKU notification endpoint active",
    });
  }



      if (
        request.method === "POST" &&
        url.pathname === "/api/payment/notification"
      ) {
        return corsResponse(await dokuNotification(request, env));
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/payment/result"
      ) {
        return paymentResult(request);
      }

      const assetPath = url.pathname;

      const isStaticAsset =
        assetPath === "/" ||
        assetPath === "/index.html" ||
        assetPath === "/favicon.svg" ||
        assetPath.startsWith("/assets/");

      if (isStaticAsset) {
        return env.ASSETS.fetch(request);
      }

      const fallbackUrl = new URL(request.url);
      fallbackUrl.pathname = "/index.html";
      fallbackUrl.search = "";

      return env.ASSETS.fetch(
        new Request(fallbackUrl.toString(), {
          method: "GET",
          headers: request.headers,
        })
      );
    } catch (error) {
      console.error(error);

      return json(
        {
          success: false,
          message: "Terjadi kesalahan pada server.",
        },
        500
      );
    }
  },
}







