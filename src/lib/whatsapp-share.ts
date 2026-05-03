import { isNative } from "./capacitor";
import type { CompanySettings, Customer, Invoice, Slip } from "../types";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

function formatMoney(value: number): string {
  return `Rs. ${moneyFormatter.format(value)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function compactId(id: string): string {
  return id.toUpperCase().slice(0, 8);
}

function getCustomerName(customer: Customer | undefined, customerId: string): string {
  if (customer?.name) return customer.name;
  if (customerId === "CASH" || !customerId) return "Cash Customer";
  return customerId;
}

function quantityUnit(measurementType: Slip["measurementType"]): string {
  return measurementType === "Volume (Brass)" ? "Brass" : "Ton";
}

function openInCurrentTab(url: string): void {
  window.location.href = url;
}

function openInNewTab(url: string): void {
  const opened = window.open(url, "_blank");
  if (opened) {
    opened.opener = null;
    return;
  }
  openInCurrentTab(url);
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function openWhatsAppMessage(message: string): void {
  if (typeof window === "undefined") return;

  const encodedMessage = encodeURIComponent(message);
  const appUrl = `whatsapp://send?text=${encodedMessage}`;
  const webUrl = `https://wa.me/?text=${encodedMessage}`;

  if (isNative() || isMobileBrowser()) {
    openInCurrentTab(appUrl);
    window.setTimeout(() => {
      if (document.visibilityState === "visible") openInCurrentTab(webUrl);
    }, 900);
    return;
  }

  openInNewTab(webUrl);
}

export function buildInvoiceWhatsAppMessage({
  invoice,
  customer,
  companySettings,
}: {
  invoice: Invoice;
  customer?: Customer;
  companySettings: CompanySettings;
}): string {
  const customerName = getCustomerName(customer, invoice.customerId);
  const itemSummary =
    invoice.items.length === 1
      ? invoice.items[0]?.materialType ?? "1 item"
      : `${invoice.items.length} items`;

  return [
    companySettings.name || "CrushTrack",
    `Invoice: ${invoice.invoiceNo}`,
    `Date: ${formatDate(invoice.date)}`,
    `Customer: ${customerName}`,
    `Items: ${itemSummary}`,
    `Total: ${formatMoney(invoice.total)}`,
    `Status: ${invoice.status}`,
  ].join("\n");
}

export function buildSlipWhatsAppMessage({
  slip,
  customerName,
  companySettings,
}: {
  slip: Slip;
  customerName: string;
  companySettings: CompanySettings;
}): string {
  const paidAmount = slip.amountPaid ?? 0;
  const balance = Math.max(0, slip.totalAmount - paidAmount);

  return [
    companySettings.name || "CrushTrack",
    `Loading Slip: #${compactId(slip.id)}`,
    `Date: ${formatDate(slip.date)}`,
    `Vehicle: ${slip.vehicleNo}`,
    `Customer: ${customerName}`,
    `Material: ${slip.materialType}`,
    `Quantity: ${slip.quantity.toFixed(2)} ${quantityUnit(slip.measurementType)}`,
    `Rate: ${formatMoney(slip.ratePerUnit)}`,
    `Total: ${formatMoney(slip.totalAmount)}`,
    paidAmount > 0 ? `Paid: ${formatMoney(paidAmount)}` : "",
    paidAmount > 0 ? `Balance: ${formatMoney(balance)}` : "",
    `Status: ${slip.status}`,
  ].filter(Boolean).join("\n");
}
