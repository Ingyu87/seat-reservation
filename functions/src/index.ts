import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
initializeApp();

const db = getFirestore();
const callableOptions = { region: "asia-northeast3", cors: "*", invoker: "public" } as const;

type ReservationStatus = "CONFIRMED" | "CANCELED";

type Reservation = {
  seatId: string;
  seatDisplayName: string;
  name: string;
  phoneLast4: string;
  email: string;
  status: ReservationStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  canceledAt?: Timestamp | null;
};

function rowLabel(row: number) {
  if (row <= 26) return String.fromCharCode(64 + row);
  const zeroBased = row - 27;
  return String.fromCharCode(65 + Math.floor(zeroBased / 26)) + String.fromCharCode(65 + (zeroBased % 26));
}

function assertString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  return value.trim();
}

function normalizePhoneLast4(value: unknown) {
  const text = assertString(value, "phoneLast4").replace(/\D/g, "");
  if (!/^\d{4}$/.test(text)) {
    throw new HttpsError("invalid-argument", "phoneLast4 must be exactly 4 digits.");
  }
  return text;
}

function normalizeEmail(value: unknown) {
  const email = assertString(value, "email").toLowerCase();
  if (!email.includes("@")) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  return email;
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 1)}***@${domain}`;
}

function toDateString(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return undefined;
}

async function assertAdmin(uid?: string, tokenAdmin?: boolean) {
  if (!uid || tokenAdmin !== true) {
    throw new HttpsError("permission-denied", "Admin permission is required.");
  }
  await getAuth().getUser(uid);
}

function adminFlag(request: { auth?: { token: unknown } }) {
  return (request.auth?.token as { admin?: boolean } | undefined)?.admin === true;
}

function displayNameToSeatId(displayName: string) {
  const [row, col] = displayName.trim().split("-");
  if (!row || !col) return null;
  return `MAIN_${row}_${col}`;
}

function mapAdminReservation(id: string, item: Reservation) {
  return {
    id,
    name: item.name,
    phoneLast4: item.phoneLast4,
    email: item.email,
    seatId: item.seatId,
    seatDisplayName: item.seatDisplayName,
    status: item.status,
    createdAt: toDateString(item.createdAt),
    updatedAt: toDateString(item.updatedAt)
  };
}

async function releaseSeatInTransaction(tx: Transaction, seatId: string) {
  if (!seatId) return;

  const seatRef = db.collection("seats").doc(seatId);
  const seatSnap = await tx.get(seatRef);
  if (!seatSnap.exists) return;

  tx.update(seatRef, {
    status: "AVAILABLE",
    reservationId: null,
    updatedAt: FieldValue.serverTimestamp()
  });
}

async function findReservationForOwner(data: Record<string, unknown>) {
  const name = assertString(data.name, "name");
  const phoneLast4 = normalizePhoneLast4(data.phoneLast4);

  const snap = await db
    .collection("reservations")
    .where("name", "==", name)
    .where("phoneLast4", "==", phoneLast4)
    .where("status", "==", "CONFIRMED")
    .limit(20)
    .get();

  if (snap.empty) {
    throw new HttpsError("not-found", "Reservation was not found.");
  }

  const match = snap.docs.sort((a, b) => {
    const aTime = (a.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0;
    const bTime = (b.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0;
    return bTime - aTime;
  })[0];
  return { id: match.id, data: match.data() as Reservation, ref: match.ref };
}

export const getSeatMap = onCall(callableOptions, async () => {
  const snap = await db.collection("seats").orderBy("sortOrder", "asc").get();
  const seats = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as { status?: string }) }));
  const reserved = seats.filter((seat) => seat.status === "RESERVED").length;
  return { total: seats.length, reserved, seats };
});

export const reserveSeat = onCall(callableOptions, async (request) => {
  const data = request.data as Record<string, unknown>;
  const seatId = assertString(data.seatId, "seatId");
  const name = assertString(data.name, "name");
  const phoneLast4 = normalizePhoneLast4(data.phoneLast4);
  const email = normalizeEmail(data.email);
  const privacyConsent = data.privacyConsent === true;

  if (!privacyConsent) {
    throw new HttpsError("invalid-argument", "Privacy consent is required.");
  }

  return db.runTransaction(async (tx) => {
    const seatRef = db.collection("seats").doc(seatId);
    const seatSnap = await tx.get(seatRef);

    if (!seatSnap.exists) {
      throw new HttpsError("not-found", "Seat was not found.");
    }

    const seat = seatSnap.data() as { displayName: string; status: string };
    if (seat.status !== "AVAILABLE") {
      throw new HttpsError("already-exists", "Seat is already reserved.");
    }

    const reservationRef = db.collection("reservations").doc();
    const payload = {
      name,
      phoneLast4,
      seatDisplayName: seat.displayName
    };

    tx.create(reservationRef, {
      seatId,
      seatDisplayName: seat.displayName,
      name,
      phoneLast4,
      email,
      status: "CONFIRMED",
      privacyConsent: true,
      privacyConsentAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      canceledAt: null
    });

    tx.update(seatRef, {
      status: "RESERVED",
      reservationId: reservationRef.id,
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.create(db.collection("notificationJobs").doc(), {
      reservationId: reservationRef.id,
      type: "EMAIL",
      event: "RESERVED",
      recipient: email,
      payload,
      status: "PENDING",
      errorMessage: null,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: null
    });

    return { reservationId: reservationRef.id, seatDisplayName: seat.displayName };
  });
});

export const lookupReservation = onCall(callableOptions, async (request) => {
  const found = await findReservationForOwner(request.data as Record<string, unknown>);
  return {
    reservationId: found.id,
    name: found.data.name,
    phoneLast4: found.data.phoneLast4,
    emailMasked: maskEmail(found.data.email),
    seat: {
      id: found.data.seatId,
      displayName: found.data.seatDisplayName
    },
    status: found.data.status,
    createdAt: toDateString(found.data.createdAt)
  };
});

export const changeSeat = onCall(callableOptions, async (request) => {
  const data = request.data as Record<string, unknown>;
  const newSeatId = assertString(data.newSeatId, "newSeatId");
  const found = await findReservationForOwner(data);

  return db.runTransaction(async (tx) => {
    const newSeatRef = db.collection("seats").doc(newSeatId);
    const newSeatSnap = await tx.get(newSeatRef);

    if (!newSeatSnap.exists) {
      throw new HttpsError("not-found", "Seat was not found.");
    }

    const newSeat = newSeatSnap.data() as { displayName: string; status: string };
    if (newSeat.status !== "AVAILABLE") {
      throw new HttpsError("already-exists", "Seat is already reserved.");
    }

    await releaseSeatInTransaction(tx, found.data.seatId);
    tx.update(newSeatRef, {
      status: "RESERVED",
      reservationId: found.id,
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(found.ref, {
      seatId: newSeatId,
      seatDisplayName: newSeat.displayName,
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.create(db.collection("notificationJobs").doc(), {
      reservationId: found.id,
      type: "EMAIL",
      event: "CHANGED",
      recipient: found.data.email,
      payload: {
        name: found.data.name,
        phoneLast4: found.data.phoneLast4,
        seatDisplayName: newSeat.displayName
      },
      status: "PENDING",
      errorMessage: null,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: null
    });

    return { seatDisplayName: newSeat.displayName };
  });
});

export const cancelReservation = onCall(callableOptions, async (request) => {
  const found = await findReservationForOwner(request.data as Record<string, unknown>);

  await db.runTransaction(async (tx) => {
    await releaseSeatInTransaction(tx, found.data.seatId);
    tx.update(found.ref, {
      status: "CANCELED",
      canceledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.create(db.collection("notificationJobs").doc(), {
      reservationId: found.id,
      type: "EMAIL",
      event: "CANCELED",
      recipient: found.data.email,
      payload: {
        name: found.data.name,
        phoneLast4: found.data.phoneLast4,
        seatDisplayName: found.data.seatDisplayName
      },
      status: "PENDING",
      errorMessage: null,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: null
    });
  });

  return { ok: true };
});

export const adminSearchReservations = onCall(callableOptions, async (request) => {
  await assertAdmin(request.auth?.uid, adminFlag(request));
  const query = String((request.data as { query?: string }).query ?? "").trim().toLowerCase();
  const snap = await db.collection("reservations").orderBy("createdAt", "desc").limit(5000).get();
  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Reservation) }))
    .filter((item) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.phoneLast4.includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.seatDisplayName.toLowerCase().includes(query)
      );
    })
    .map((item) => mapAdminReservation(item.id, item));

  return { items };
});

export const adminDeleteReservation = onCall(callableOptions, async (request) => {
  await assertAdmin(request.auth?.uid, adminFlag(request));
  const reservationId = assertString((request.data as { reservationId?: string }).reservationId, "reservationId");
  const reservationRef = db.collection("reservations").doc(reservationId);

  await db.runTransaction(async (tx) => {
    const reservationSnap = await tx.get(reservationRef);
    if (!reservationSnap.exists) {
      throw new HttpsError("not-found", "Reservation was not found.");
    }

    const reservation = reservationSnap.data() as Reservation;
    if (reservation.status === "CONFIRMED") {
      await releaseSeatInTransaction(tx, reservation.seatId);
    }

    tx.update(reservationRef, {
      status: "CANCELED",
      canceledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true };
});

export const adminUpdateReservation = onCall(callableOptions, async (request) => {
  await assertAdmin(request.auth?.uid, adminFlag(request));
  const data = request.data as Record<string, unknown>;
  const reservationId = assertString(data.reservationId, "reservationId");
  const name = assertString(data.name, "name");
  const phoneLast4 = normalizePhoneLast4(data.phoneLast4);
  const email = normalizeEmail(data.email);
  const seatDisplayName =
    typeof data.seatDisplayName === "string" && data.seatDisplayName.trim()
      ? data.seatDisplayName.trim()
      : undefined;

  const reservationRef = db.collection("reservations").doc(reservationId);

  return db.runTransaction(async (tx) => {
    const reservationSnap = await tx.get(reservationRef);
    if (!reservationSnap.exists) {
      throw new HttpsError("not-found", "Reservation was not found.");
    }

    const reservation = reservationSnap.data() as Reservation;
    const updates: Record<string, unknown> = {
      name,
      phoneLast4,
      email,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (seatDisplayName && reservation.status === "CONFIRMED") {
      const newSeatId = displayNameToSeatId(seatDisplayName);
      if (!newSeatId) {
        throw new HttpsError("invalid-argument", "Seat display name must look like A-1.");
      }
      if (newSeatId !== reservation.seatId) {
        const newSeatRef = db.collection("seats").doc(newSeatId);
        const newSeatSnap = await tx.get(newSeatRef);

        if (!newSeatSnap.exists) {
          throw new HttpsError("not-found", "Seat was not found.");
        }

        const newSeat = newSeatSnap.data() as { displayName: string; status: string };
        if (newSeat.status !== "AVAILABLE") {
          throw new HttpsError("already-exists", "Seat is already reserved.");
        }

        await releaseSeatInTransaction(tx, reservation.seatId);
        tx.update(newSeatRef, {
          status: "RESERVED",
          reservationId,
          updatedAt: FieldValue.serverTimestamp()
        });
        updates.seatId = newSeatId;
        updates.seatDisplayName = newSeat.displayName;
      }
    }

    tx.update(reservationRef, updates);
    return mapAdminReservation(reservationId, {
      ...reservation,
      ...updates,
      name,
      phoneLast4,
      email,
      seatId: (updates.seatId as string | undefined) ?? reservation.seatId,
      seatDisplayName: (updates.seatDisplayName as string | undefined) ?? reservation.seatDisplayName
    } as Reservation);
  });
});

export const adminResetAllReservations = onCall(callableOptions, async (request) => {
  await assertAdmin(request.auth?.uid, adminFlag(request));

  const reservationsSnap = await db.collection("reservations").where("status", "==", "CONFIRMED").get();
  const seatsSnap = await db.collection("seats").where("status", "==", "RESERVED").get();

  let batch = db.batch();
  let inBatch = 0;
  let canceled = 0;
  let released = 0;

  async function commitIfNeeded(force = false) {
    if (inBatch === 0 || (!force && inBatch < 450)) return;
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
  }

  for (const doc of reservationsSnap.docs) {
    batch.update(doc.ref, {
      status: "CANCELED",
      canceledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    inBatch += 1;
    canceled += 1;
    await commitIfNeeded();
  }

  for (const doc of seatsSnap.docs) {
    batch.update(doc.ref, {
      status: "AVAILABLE",
      reservationId: null,
      updatedAt: FieldValue.serverTimestamp()
    });
    inBatch += 1;
    released += 1;
    await commitIfNeeded();
  }

  await commitIfNeeded(true);
  return { canceled, released };
});

export const seedSeats = onCall(callableOptions, async (request) => {
  await assertAdmin(request.auth?.uid, adminFlag(request));

  const rows = 50;
  const cols = 50;
  const existingIds = new Set(
    (await db.collection("seats").select().get()).docs.map((doc) => doc.id)
  );

  let batch = db.batch();
  let inBatch = 0;
  let total = 0;
  let created = 0;
  let updated = 0;

  async function commitIfNeeded(force = false) {
    if (inBatch === 0 || (!force && inBatch < 450)) return;
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
  }

  for (let row = 1; row <= rows; row += 1) {
    const label = rowLabel(row);
    for (let col = 1; col <= cols; col += 1) {
      const id = `MAIN_${label}_${col}`;
      const ref = db.collection("seats").doc(id);
      const metadata = {
        section: "MAIN",
        rowLabel: label,
        seatNumber: col,
        displayName: `${label}-${col}`,
        sortOrder: row * 1000 + col,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (existingIds.has(id)) {
        batch.set(ref, metadata, { merge: true });
        updated += 1;
      } else {
        batch.set(ref, {
          ...metadata,
          status: "AVAILABLE",
          reservationId: null
        });
        created += 1;
      }

      inBatch += 1;
      total += 1;
      await commitIfNeeded();
    }
  }

  await commitIfNeeded(true);
  return { total, created, updated };
});
