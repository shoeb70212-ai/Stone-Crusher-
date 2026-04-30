/**
 * ESC/POS Bluetooth thermal printer support for CrushTrack.
 *
 * Architecture:
 *   - Uses @capacitor-community/bluetooth-le to scan and communicate.
 *   - Targets the BLE SPP (Serial Port Profile) used by most Chinese thermal
 *     printers (Xprinter XP-58/80, GOOJPRT, rongta, etc.).
 *   - Common service/characteristic UUIDs are tried in order.
 *   - The raw ESC/POS byte sequence is built from scratch — no external library
 *     needed as the required command set is minimal (init, text, feed, cut).
 *   - All functions are no-ops on web.
 *
 * Printer BLE profile (most common):
 *   Service:         49535343-FE7D-4AE5-8FA9-9FAFD205E455  (Nordic UART-like)
 *   TX Characteristic: 49535343-8841-43F4-A8D4-ECBE34729BB3
 * Fallback:
 *   Service:         0x18F0
 *   Characteristic:  0x2AF1
 */

import { isNative } from './capacitor';

// ---------------------------------------------------------------------------
// ESC/POS byte constants
// ---------------------------------------------------------------------------

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

/** ESC @ — Initialize printer (clears buffer, resets modes) */
const CMD_INIT = Uint8Array.from([ESC, 0x40]);

/** ESC ! 0 — Normal text mode */
const CMD_NORMAL = Uint8Array.from([ESC, 0x21, 0x00]);

/** ESC ! 8 — Double-width bold (used for header) */
const CMD_BOLD_WIDE = Uint8Array.from([ESC, 0x21, 0x38]);

/** ESC a 1 — Center align */
const CMD_CENTER = Uint8Array.from([ESC, 0x61, 0x01]);

/** ESC a 0 — Left align */
const CMD_LEFT = Uint8Array.from([ESC, 0x61, 0x00]);

/** GS V 66 3 — Partial cut with 3mm feed */
const CMD_CUT = Uint8Array.from([GS, 0x56, 0x42, 0x03]);

/** Feed N lines */
const feed = (n: number) => new Uint8Array(n).fill(LF);

/** Encode a UTF-8 string to bytes */
const text = (str: string) => new TextEncoder().encode(str + '\n');

/** Concatenate multiple Uint8Arrays */
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Left-pad a string to a fixed width */
const pad = (s: string, w: number) => s.padEnd(w).slice(0, w);

/** Right-align a value within a field of width `total` given a left label */
const twoCol = (label: string, value: string, width = 32) => {
  const gap = width - label.length - value.length;
  return label + ' '.repeat(Math.max(1, gap)) + value + '\n';
};

// ---------------------------------------------------------------------------
// Public data types
// ---------------------------------------------------------------------------

export interface BluetoothDevice {
  deviceId: string;
  name: string;
}

export interface SlipPrintData {
  token: string;
  date: string;
  vehicleNo: string;
  driverName?: string;
  customerName: string;
  materialType: string;
  quantity: string;
  ratePerUnit: number;
  totalAmount: number;
  amountPaid?: number;
  operatorName?: string;
  companyName: string;
  receiptFooter?: string;
}

// ---------------------------------------------------------------------------
// BLE constants — tried in priority order
// ---------------------------------------------------------------------------

const PRINTER_PROFILES = [
  {
    // Nordic UART / most common Chinese thermal printers
    serviceUuid: '49535343-FE7D-4AE5-8FA9-9FAFD205E455',
    characteristicUuid: '49535343-8841-43F4-A8D4-ECBE34729BB3',
  },
  {
    // Xprinter / rongta common profile
    serviceUuid: '0000FF00-0000-1000-8000-00805F9B34FB',
    characteristicUuid: '0000FF02-0000-1000-8000-00805F9B34FB',
  },
  {
    // Generic BLE serial (18F0 / 2AF1)
    serviceUuid: '000018F0-0000-1000-8000-00805F9B34FB',
    characteristicUuid: '00002AF1-0000-1000-8000-00805F9B34FB',
  },
];

// Stored connected device id for the session
let connectedDeviceId: string | null = null;
let connectedProfile: typeof PRINTER_PROFILES[0] | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scans for nearby Bluetooth LE thermal printers for up to 5 seconds.
 * Returns the discovered devices.
 */
export async function scanForPrinters(): Promise<BluetoothDevice[]> {
  if (!isNative()) return [];

  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  await BleClient.initialize({ androidNeverForLocation: true });

  const devices: BluetoothDevice[] = [];

  await BleClient.requestLEScan(
    {
      // No service filter — many printers don't advertise their service UUIDs
    },
    (result) => {
      const name = result.localName ?? result.device.name ?? '';
      if (name && !devices.find((d) => d.deviceId === result.device.deviceId)) {
        devices.push({ deviceId: result.device.deviceId, name });
      }
    },
  );

  await new Promise<void>((r) => setTimeout(r, 5000));
  await BleClient.stopLEScan();

  return devices;
}

/**
 * Connects to a printer by device ID and auto-detects its write characteristic.
 * Returns true on success.
 */
export async function connectPrinter(deviceId: string): Promise<boolean> {
  if (!isNative()) return false;

  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  await BleClient.initialize({ androidNeverForLocation: true });

  try {
    await BleClient.connect(deviceId, () => {
      // Device disconnected — reset state
      connectedDeviceId = null;
      connectedProfile = null;
    });

    // Try each profile until one works
    for (const profile of PRINTER_PROFILES) {
      try {
        const services = await BleClient.getServices(deviceId);
        const svcNorm = profile.serviceUuid.toLowerCase();
        const service = services.find((s) => s.uuid.toLowerCase() === svcNorm);
        if (!service) continue;

        const charNorm = profile.characteristicUuid.toLowerCase();
        const char = service.characteristics.find((c) => c.uuid.toLowerCase() === charNorm);
        if (!char) continue;

        connectedDeviceId = deviceId;
        connectedProfile = profile;
        return true;
      } catch {
        continue;
      }
    }

    // No matching profile found
    await BleClient.disconnect(deviceId);
    return false;
  } catch {
    return false;
  }
}

/** Disconnects the currently connected printer. */
export async function disconnectPrinter(): Promise<void> {
  if (!isNative() || !connectedDeviceId) return;
  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  try {
    await BleClient.disconnect(connectedDeviceId);
  } finally {
    connectedDeviceId = null;
    connectedProfile = null;
  }
}

/** Returns the currently connected device ID, or null. */
export function getConnectedPrinterId(): string | null {
  return connectedDeviceId;
}

/**
 * Prints a dispatch slip to the connected BLE thermal printer.
 * Caller must have called `connectPrinter` first.
 */
export async function printSlip(data: SlipPrintData): Promise<void> {
  if (!isNative() || !connectedDeviceId || !connectedProfile) {
    throw new Error('No printer connected');
  }

  const bytes = buildSlipBytes(data);
  await writeChunked(connectedDeviceId, connectedProfile, bytes);
}

// ---------------------------------------------------------------------------
// ESC/POS document builder
// ---------------------------------------------------------------------------

function buildSlipBytes(d: SlipPrintData): Uint8Array {
  const W = 32; // 58mm paper width in characters

  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CENTER,
    CMD_BOLD_WIDE,
    text(d.companyName.slice(0, 16).toUpperCase()),
    CMD_NORMAL,
    text('GATE PASS'),
    feed(1),
    CMD_LEFT,
    text('-'.repeat(W)),
    text(twoCol('Token:', `#${d.token}`, W)),
    text(twoCol('Date:', d.date, W)),
    text(twoCol('Vehicle:', d.vehicleNo, W)),
  ];

  if (d.driverName) {
    parts.push(text(twoCol('Driver:', d.driverName.slice(0, 18), W)));
  }

  parts.push(
    text(twoCol('Customer:', d.customerName.slice(0, 16), W)),
    text(twoCol('Material:', d.materialType, W)),
    text(twoCol('Qty:', d.quantity, W)),
    text(twoCol('Rate:', `Rs${d.ratePerUnit}`, W)),
    text('-'.repeat(W)),
    text(twoCol('TOTAL:', `Rs${d.totalAmount}`, W)),
  );

  if (d.amountPaid && d.amountPaid > 0) {
    parts.push(
      text(twoCol('Paid:', `Rs${d.amountPaid}`, W)),
      text(twoCol('Due:', `Rs${Math.max(0, d.totalAmount - d.amountPaid)}`, W)),
    );
  }

  parts.push(
    text('-'.repeat(W)),
    CMD_CENTER,
    text(d.receiptFooter || 'Thank you!'),
    feed(3),
    CMD_CUT,
  );

  return concat(...parts);
}

// ---------------------------------------------------------------------------
// Write helper — splits bytes into 20-byte BLE chunks
// ---------------------------------------------------------------------------

async function writeChunked(
  deviceId: string,
  profile: typeof PRINTER_PROFILES[0],
  data: Uint8Array,
): Promise<void> {
  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  const CHUNK = 20;

  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    const buffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
    await BleClient.write(
      deviceId,
      profile.serviceUuid,
      profile.characteristicUuid,
      new DataView(buffer),
    );
    // Small delay to avoid overwhelming the printer's BLE buffer
    await new Promise<void>((r) => setTimeout(r, 20));
  }
}
