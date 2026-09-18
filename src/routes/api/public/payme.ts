import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

import { fulfillPayment } from "@/lib/payme.server";

/**
 * Payme Merchant API — single JSON-RPC endpoint handling every method:
 * CheckPerformTransaction, CreateTransaction, PerformTransaction,
 * CancelTransaction, CheckTransaction.
 */

const ERRORS = {
  ORDER_NOT_FOUND: {
    code: -31050,
    message: {
      uz: "Buyurtma topilmadi",
      ru: "Заказ не найден",
      en: "Order not found",
    },
  },
  INVALID_AMOUNT: {
    code: -31001,
    message: {
      uz: "Summa noto'g'ri",
      ru: "Неверная сумма",
      en: "Invalid amount",
    },
  },
  CANNOT_PERFORM: {
    code: -31008,
    message: {
      uz: "Amalni bajarib bo'lmaydi",
      ru: "Невозможно выполнить операцию",
      en: "Cannot perform operation",
    },
  },
  ORDER_PROCESSING: {
    code: -31099,
    message: {
      uz: "Buyurtma to'lovi hozirda amalga oshirilmoqda",
      ru: "Платеж на этот заказ на данный момент обрабатывается",
      en: "Order payment is already being processed",
    },
  },
  TRANSACTION_NOT_FOUND: {
    code: -31003,
    message: {
      uz: "Tranzaksiya topilmadi",
      ru: "Транзакция не найдена",
      en: "Transaction not found",
    },
  },
  METHOD_NOT_FOUND: { code: -32601, message: { uz: "Metod topilmadi", ru: "Метод не найден", en: "Method not found" } },
  UNAUTHORIZED: { code: -32504, message: { uz: "Ruxsat yo'q", ru: "Недостаточно привилегий", en: "Insufficient privileges" } },
} as const;

type RpcErrorDef = (typeof ERRORS)[keyof typeof ERRORS];

function rpcError(id: unknown, error: RpcErrorDef) {
  // Payme sandbox renders `error.message` directly, so send a plain string
  // (spec-compatible) and keep localized texts in `data`.
  return Response.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code: error.code, message: error.message.ru, data: error.message },
  });
}

function rpcResult(id: unknown, result: Record<string, unknown>) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

/** Verifies Payme's HTTP Basic auth (login "Paycom", password = merchant key). */
function isAuthorized(request: Request): boolean {
  const key = process.env["PAYME_API_KEY"];
  if (!key) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Basic ${Buffer.from(`Paycom:${key}`).toString("base64")}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type PaymeAccount = { order_id?: string };

async function loadPayment(orderId: string | undefined) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!orderId) return null;
  const { data } = await supabaseAdmin
    .from("payments")
    .select("id, amount, status, purpose, months")
    .eq("id", orderId)
    .maybeSingle();
  return data;
}

/** Fiscal data (IKPU/MXIK) required by Payme receipts. */
const IKPU_CODE = "10501003001000000";
const PACKAGE_CODE = "1504838";

function fiscalDetail(payment: { amount: number; purpose: string | null; months: number | null }) {
  const title =
    payment.purpose === "promotion"
      ? `UBU Real Estate — e'lonni TOP'ga ko'tarish (${payment.months || 7} kun)`
      : `UBU Real Estate — Premium obuna (${payment.months || 1} oy)`;
  return {
    receipt_type: 0, // 0 = debet (100% to'lov)
    items: [
      {
        title,
        price: payment.amount * 100,
        count: 1,
        code: IKPU_CODE,
        package_code: PACKAGE_CODE,
        vat_percent: 0,
      },
    ],
  };
}

async function loadTransaction(paymeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("payme_transactions")
    .select("*")
    .eq("payme_id", paymeId)
    .maybeSingle();
  return data;
}

function transactionView(tx: {
  create_time: number;
  perform_time: number;
  cancel_time: number;
  payme_id: string;
  state: number;
  reason: number | null;
}) {
  return {
    create_time: Number(tx.create_time),
    perform_time: Number(tx.perform_time),
    cancel_time: Number(tx.cancel_time),
    transaction: tx.payme_id,
    state: tx.state,
    reason: tx.reason,
  };
}

async function handleRpc(id: unknown, method: string, params: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  switch (method) {
    case "CheckPerformTransaction": {
      const account = (params['account'] ?? {}) as PaymeAccount;
      const payment = await loadPayment(account.order_id);
      if (!payment || payment.status === "canceled") return rpcError(id, ERRORS.ORDER_NOT_FOUND);
      if (payment.status !== "pending") return rpcError(id, ERRORS.ORDER_PROCESSING);
      if (payment.amount * 100 !== Number(params['amount'])) return rpcError(id, ERRORS.INVALID_AMOUNT);
      return rpcResult(id, { allow: true });
    }

    case "CreateTransaction": {
      const account = (params['account'] ?? {}) as PaymeAccount;
      const payment = await loadPayment(account.order_id);
      if (!payment || payment.status === "canceled") return rpcError(id, ERRORS.ORDER_NOT_FOUND);
      if (payment.status !== "pending") return rpcError(id, ERRORS.ORDER_PROCESSING);
      if (payment.amount * 100 !== Number(params['amount'])) return rpcError(id, ERRORS.INVALID_AMOUNT);

      const paymeId = String(params['id']);
      const existing = await loadTransaction(paymeId);
      if (existing) {
        if (existing.state < 0) return rpcError(id, ERRORS.CANNOT_PERFORM);
        return rpcResult(id, { ...transactionView(existing), receivers: null });
      }

      // Only one active transaction per order
      const { data: active } = await supabaseAdmin
        .from("payme_transactions")
        .select("payme_id")
        .eq("payment_id", payment.id)
        .gt("state", 0)
        .maybeSingle();
      if (active) return rpcError(id, ERRORS.ORDER_PROCESSING);

      const { data: tx, error } = await supabaseAdmin
        .from("payme_transactions")
        .insert({
          payme_id: paymeId,
          payment_id: payment.id,
          state: 1,
          amount_tiyin: Number(params['amount']),
          create_time: Number(params['time']),
        })
        .select("*")
        .single();
      if (error || !tx) return rpcError(id, ERRORS.CANNOT_PERFORM);
      return rpcResult(id, { ...transactionView(tx), receivers: null });
    }

    case "PerformTransaction": {
      const tx = await loadTransaction(String(params['id']));
      if (!tx) return rpcError(id, ERRORS.TRANSACTION_NOT_FOUND);
      if (tx.state === 2) return rpcResult(id, transactionView(tx));
      if (tx.state !== 1) return rpcError(id, ERRORS.CANNOT_PERFORM);

      const performTime = Date.now();
      await supabaseAdmin
        .from("payme_transactions")
        .update({ state: 2, perform_time: performTime })
        .eq("payme_id", tx.payme_id);

      await fulfillPayment(tx.payment_id);

      return rpcResult(id, {
        ...transactionView({ ...tx, state: 2, perform_time: performTime }),
      });
    }

    case "CancelTransaction": {
      const tx = await loadTransaction(String(params['id']));
      if (!tx) return rpcError(id, ERRORS.TRANSACTION_NOT_FOUND);
      const reason = Number(params['reason']) || null;

      if (tx.state < 0) return rpcResult(id, transactionView(tx));

      const cancelTime = Date.now();
      const newState = tx.state === 2 ? -2 : -1;
      await supabaseAdmin
        .from("payme_transactions")
        .update({ state: newState, cancel_time: cancelTime, reason })
        .eq("payme_id", tx.payme_id);

      // Roll back the payment only if it was not yet fulfilled
      await supabaseAdmin
        .from("payments")
        .update({ status: "canceled" })
        .eq("id", tx.payment_id)
        .eq("status", "pending");

      return rpcResult(id, {
        ...transactionView({ ...tx, state: newState, cancel_time: cancelTime, reason }),
      });
    }

    case "CheckTransaction": {
      const tx = await loadTransaction(String(params['id']));
      if (!tx) return rpcError(id, ERRORS.TRANSACTION_NOT_FOUND);
      return rpcResult(id, transactionView(tx));
    }

    case "GetStatement": {
      const from = Number(params['from']);
      const to = Number(params['to']);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
        return rpcError(id, ERRORS.CANNOT_PERFORM);
      }

      const { data: txs } = await supabaseAdmin
        .from("payme_transactions")
        .select("*, payments!inner(amount)")
        .gte("create_time", from)
        .lte("create_time", to)
        .order("create_time", { ascending: true });

      const transactions = (txs ?? []).map((tx) => {
        const payment = Array.isArray(tx.payments) ? tx.payments[0] : tx.payments;
        return {
          id: tx.payme_id,
          time: Number(tx.create_time),
          amount: payment?.amount ? Number(payment.amount) * 100 : Number(tx.amount_tiyin),
          account: { order_id: tx.payment_id },
          create_time: Number(tx.create_time),
          perform_time: Number(tx.perform_time),
          cancel_time: Number(tx.cancel_time),
          transaction: tx.payme_id,
          state: tx.state,
          reason: tx.reason,
          receivers: null,
        };
      });

      return rpcResult(id, { transactions });
    }

    default:
      return rpcError(id, ERRORS.METHOD_NOT_FOUND);
  }
}

export const Route = createFileRoute("/api/public/payme")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return rpcError(null, ERRORS.UNAUTHORIZED);
        }

        let body: { id?: unknown; method?: string; params?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
            { status: 400 },
          );
        }

        return handleRpc(body.id, String(body.method ?? ""), body.params ?? {});
      },
    },
  },
});
