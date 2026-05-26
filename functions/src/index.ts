import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { SEAT_LAYOUT, SEAT_LAYOUT_TOTAL } from "./seat-layout.generated.js";

initializeApp();

const db = getFirestore();
const callableOptions = { region: "asia-northeast3", cors: "*", invoker: "public" } as const;
const MAX_SEATS_PER_RESERVATION = 4;

type ReservationStatus = "CONFIRMED" | "CANCELED";

type Reservation = {
  seatIds?: string[];
  seatDisplayNames?: string[];
  seatCount?: number;
  seatId?: string;
  seatDisplayName?: string;
  name: string;
  schoolName?: string;
  phoneLast4: string;
  status: ReservationStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  canceledAt?: Timestamp | null;
};

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

function normalizeSeatIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "seatIds is required.");
  }

  const seatIds = value.map((item) => assertString(item, "seatId"));
  const unique = Array.from(new Set(seatIds));
  if (unique.length !== seatIds.length) {
    throw new HttpsError("invalid-argument", "Duplicate seats are not allowed.");
  }
  if (unique.length < 1 || unique.length > MAX_SEATS_PER_RESERVATION) {
    throw new HttpsError("invalid-argument", `You can reserve 1-${MAX_SEATS_PER_RESERVATION} seats.`);
  }
  return unique;
}

function reservationSeatIds(item: Reservation) {
  return item.seatIds?.length ? item.seatIds : item.seatId ? [item.seatId] : [];
}

function reservationSeatDisplayNames(item: Reservation) {
  return item.seatDisplayNames?.length
    ? item.seatDisplayNames
    : item.seatDisplayName
      ? [item.seatDisplayName]
      : [];
}

function activeReservationKey(name: string, schoolName: string, phoneLast4: string) {
  return [name, schoolName, phoneLast4].map((part) => encodeURIComponent(part.trim())).join("__");
}

function activeReservationRef(name: string, schoolName: string, phoneLast4: string) {
  return db.collection("activeReservationKeys").doc(activeReservationKey(name, schoolName, phoneLast4));
}

function deleteActiveReservationKey(tx: Transaction, reservation: Reservation) {
  if (!reservation.schoolName) return;
  tx.delete(activeReservationRef(reservation.name, reservation.schoolName, reservation.phoneLast4));
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
  const normalized = displayName.trim().replace(/\s+/g, " ");
  const match = normalized.match(/^(?:(1층|2층)\s*)?([가-힣]\d{4})$/);
  if (!match) return null;

  const floor = match[1] === "2층" ? "F2" : match[1] === "1층" ? "F1" : null;
  const label = match[2];
  if (floor) return `${floor}_${label}`;

  const matches = SEAT_LAYOUT.filter((seat) => seat.label === label);
  return matches.length === 1 ? matches[0].id : null;
}

function normalizeSeatDisplayNames(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const names = value.map((item) => assertString(item, "seatDisplayName"));
  return names.length ? names : undefined;
}

function mapAdminReservation(id: string, item: Reservation) {
  const seatIds = reservationSeatIds(item);
  const seatDisplayNames = reservationSeatDisplayNames(item);

  return {
    id,
    name: item.name,
    schoolName: item.schoolName ?? "",
    phoneLast4: item.phoneLast4,
    seatIds,
    seatDisplayNames,
    seatCount: item.seatCount ?? seatIds.length,
    seatId: seatIds[0],
    seatDisplayName: seatDisplayNames.join(", "),
    status: item.status,
    createdAt: toDateString(item.createdAt),
    updatedAt: toDateString(item.updatedAt)
  };
}

async function releaseSeatsInTransaction(tx: Transaction, seatIds: string[]) {
  const seatRefs = seatIds.map((seatId) => db.collection("seats").doc(seatId));
  const seatSnaps = [];

  for (const seatRef of seatRefs) {
    seatSnaps.push(await tx.get(seatRef));
  }

  seatSnaps.forEach((seatSnap, index) => {
    if (!seatSnap.exists) return;

    tx.update(seatRefs[index], {
      status: "AVAILABLE",
      reservationId: null,
      updatedAt: FieldValue.serverTimestamp()
    });
  });
}

async function findReservationForOwner(data: Record<string, unknown>) {
  const name = assertString(data.name, "name");
  const schoolName = assertString(data.schoolName, "schoolName");
  const phoneLast4 = normalizePhoneLast4(data.phoneLast4);

  const snap = await db
    .collection("reservations")
    .where("name", "==", name)
    .where("schoolName", "==", schoolName)
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

async function commitBatch(batchState: { batch: FirebaseFirestore.WriteBatch; count: number }, force = false) {
  if (batchState.count === 0 || (!force && batchState.count < 450)) return;
  await batchState.batch.commit();
  batchState.batch = db.batch();
  batchState.count = 0;
}

async function ensureSeatsReady() {
  const layoutById = new Map(SEAT_LAYOUT.map((seat, index) => [seat.id, { seat, index }]));
  const existingSnap = await db.collection("seats").select().get();
  const existingIds = new Set(existingSnap.docs.map((doc) => doc.id));
  const staleDocs = existingSnap.docs.filter((doc) => !layoutById.has(doc.id));
  const missingOrExisting = SEAT_LAYOUT.filter((seat) => !existingIds.has(seat.id) || existingIds.has(seat.id));

  if (staleDocs.length === 0 && SEAT_LAYOUT.every((seat) => existingIds.has(seat.id))) {
    return { total: SEAT_LAYOUT_TOTAL, created: 0, updated: 0, deleted: 0 };
  }

  const batchState = { batch: db.batch(), count: 0 };
  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const doc of staleDocs) {
    batchState.batch.delete(doc.ref);
    batchState.count += 1;
    deleted += 1;
    await commitBatch(batchState);
  }

  for (const layout of missingOrExisting) {
    const ref = db.collection("seats").doc(layout.id);
    const index = layoutById.get(layout.id)?.index ?? 0;
    const metadata = {
      floor: layout.floor,
      floorLabel: layout.floorLabel,
      label: layout.label,
      area: layout.area,
      seatRow: layout.seatRow,
      seatNumber: layout.seatNumber,
      gridRow: layout.gridRow,
      gridColumn: layout.gridColumn,
      displayName: layout.displayName,
      sortOrder: index + 1,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (existingIds.has(layout.id)) {
      batchState.batch.set(ref, metadata, { merge: true });
      updated += 1;
    } else {
      batchState.batch.set(ref, {
        ...metadata,
        status: "AVAILABLE",
        reservationId: null
      });
      created += 1;
    }

    batchState.count += 1;
    await commitBatch(batchState);
  }

  await commitBatch(batchState, true);
  return { total: SEAT_LAYOUT_TOTAL, created, updated, deleted };
}

export const getSeatMap = onCall(callableOptions, async () => {
  await ensureSeatsReady();
  const snap = await db.collection("seats").orderBy("sortOrder", "asc").get();
  const seats = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as { status?: string }) }));
  const reserved = seats.filter((seat) => seat.status === "RESERVED").length;
  return { total: seats.length, reserved, seats };
});

export const reserveSeat = onCall(callableOptions, async (request) => {
  const data = request.data as Record<string, unknown>;
  const seatIds = normalizeSeatIds(data.seatIds);
  const name = assertString(data.name, "name");
  const schoolName = assertString(data.schoolName, "schoolName");
  const phoneLast4 = normalizePhoneLast4(data.phoneLast4);
  const privacyConsent = data.privacyConsent === true;

  if (!privacyConsent) {
    throw new HttpsError("invalid-argument", "Privacy consent is required.");
  }

  return db.runTransaction(async (tx) => {
    const duplicateRef = activeReservationRef(name, schoolName, phoneLast4);
    const duplicateSnap = await tx.get(duplicateRef);
    const duplicateReservationSnap = await tx.get(
      db
        .collection("reservations")
        .where("name", "==", name)
        .where("schoolName", "==", schoolName)
        .where("phoneLast4", "==", phoneLast4)
        .where("status", "==", "CONFIRMED")
        .limit(1)
    );

    if (duplicateSnap.exists || !duplicateReservationSnap.empty) {
      throw new HttpsError("already-exists", "이미 예약된 정보가 있습니다. 예약 조회에서 확인해 주세요.");
    }

    const seatRefs = seatIds.map((seatId) => db.collection("seats").doc(seatId));
    const seatSnaps = [];

    for (const seatRef of seatRefs) {
      seatSnaps.push(await tx.get(seatRef));
    }

    const seatDisplayNames: string[] = [];
    for (const seatSnap of seatSnaps) {
      if (!seatSnap.exists) {
        throw new HttpsError("not-found", "Seat was not found.");
      }

      const seat = seatSnap.data() as { displayName: string; status: string };
      if (seat.status !== "AVAILABLE") {
        throw new HttpsError("already-exists", "Seat is already reserved.");
      }
      seatDisplayNames.push(seat.displayName);
    }

    const reservationRef = db.collection("reservations").doc();
    tx.create(duplicateRef, {
      reservationId: reservationRef.id,
      name,
      schoolName,
      phoneLast4,
      createdAt: FieldValue.serverTimestamp()
    });

    tx.create(reservationRef, {
      seatIds,
      seatDisplayNames,
      seatCount: seatIds.length,
      seatId: seatIds[0],
      seatDisplayName: seatDisplayNames.join(", "),
      name,
      schoolName,
      phoneLast4,
      status: "CONFIRMED",
      privacyConsent: true,
      privacyConsentAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      canceledAt: null
    });

    for (const seatRef of seatRefs) {
      tx.update(seatRef, {
        status: "RESERVED",
        reservationId: reservationRef.id,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    return { reservationId: reservationRef.id, seatDisplayNames };
  });
});

export const lookupReservation = onCall(callableOptions, async (request) => {
  const found = await findReservationForOwner(request.data as Record<string, unknown>);
  const seatIds = reservationSeatIds(found.data);
  const seatDisplayNames = reservationSeatDisplayNames(found.data);

  return {
    reservationId: found.id,
    name: found.data.name,
    schoolName: found.data.schoolName ?? "",
    phoneLast4: found.data.phoneLast4,
    seatCount: found.data.seatCount ?? seatIds.length,
    seats: seatDisplayNames.map((displayName, index) => ({
      id: seatIds[index],
      displayName
    })),
    seat: {
      id: seatIds[0],
      displayName: seatDisplayNames[0] ?? "-"
    },
    status: found.data.status,
    createdAt: toDateString(found.data.createdAt)
  };
});

export const changeSeat = onCall(callableOptions, async (request) => {
  const data = request.data as Record<string, unknown>;
  const newSeatIds = normalizeSeatIds(data.newSeatIds);
  const found = await findReservationForOwner(data);
  const currentSeatIds = reservationSeatIds(found.data);

  if (newSeatIds.length !== currentSeatIds.length) {
    throw new HttpsError("invalid-argument", "Seat count cannot be changed.");
  }

  return db.runTransaction(async (tx) => {
    const newSeatRefs = newSeatIds.map((seatId) => db.collection("seats").doc(seatId));
    const currentSet = new Set(currentSeatIds);
    const newSeatDisplayNames: string[] = [];

    for (const newSeatRef of newSeatRefs) {
      const newSeatSnap = await tx.get(newSeatRef);
      if (!newSeatSnap.exists) {
        throw new HttpsError("not-found", "Seat was not found.");
      }

      const newSeat = newSeatSnap.data() as { displayName: string; status: string };
      if (!currentSet.has(newSeatRef.id) && newSeat.status !== "AVAILABLE") {
        throw new HttpsError("already-exists", "Seat is already reserved.");
      }
      newSeatDisplayNames.push(newSeat.displayName);
    }

    await releaseSeatsInTransaction(
      tx,
      currentSeatIds.filter((seatId) => !newSeatIds.includes(seatId))
    );

    for (const newSeatRef of newSeatRefs) {
      tx.update(newSeatRef, {
        status: "RESERVED",
        reservationId: found.id,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    tx.update(found.ref, {
      seatIds: newSeatIds,
      seatDisplayNames: newSeatDisplayNames,
      seatCount: newSeatIds.length,
      seatId: newSeatIds[0],
      seatDisplayName: newSeatDisplayNames.join(", "),
      updatedAt: FieldValue.serverTimestamp()
    });

    return { seatDisplayNames: newSeatDisplayNames };
  });
});

export const cancelReservation = onCall(callableOptions, async (request) => {
  const found = await findReservationForOwner(request.data as Record<string, unknown>);

  await db.runTransaction(async (tx) => {
    await releaseSeatsInTransaction(tx, reservationSeatIds(found.data));
    deleteActiveReservationKey(tx, found.data);
    tx.update(found.ref, {
      status: "CANCELED",
      canceledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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
      const seatDisplayNames = reservationSeatDisplayNames(item).join(", ").toLowerCase();
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        (item.schoolName ?? "").toLowerCase().includes(query) ||
        item.phoneLast4.includes(query) ||
        seatDisplayNames.includes(query)
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
      await releaseSeatsInTransaction(tx, reservationSeatIds(reservation));
      deleteActiveReservationKey(tx, reservation);
    }

    tx.delete(reservationRef);
  });

  return { ok: true };
});

export const adminUpdateReservation = onCall(callableOptions, async (request) => {
  await assertAdmin(request.auth?.uid, adminFlag(request));
  const data = request.data as Record<string, unknown>;
  const reservationId = assertString(data.reservationId, "reservationId");
  const name = assertString(data.name, "name");
  const schoolName = assertString(data.schoolName, "schoolName");
  const phoneLast4 = normalizePhoneLast4(data.phoneLast4);
  const seatDisplayNames = normalizeSeatDisplayNames(data.seatDisplayNames);

  const reservationRef = db.collection("reservations").doc(reservationId);

  return db.runTransaction(async (tx) => {
    let nextActiveRef: ReturnType<typeof activeReservationRef> | null = null;
    let shouldDeleteCurrentActiveRef = false;
    let shouldCreateNextActiveRef = false;

    const reservationSnap = await tx.get(reservationRef);
    if (!reservationSnap.exists) {
      throw new HttpsError("not-found", "Reservation was not found.");
    }

    const reservation = reservationSnap.data() as Reservation;
    if (reservation.status === "CONFIRMED") {
      nextActiveRef = activeReservationRef(name, schoolName, phoneLast4);
      const nextActiveSnap = await tx.get(nextActiveRef);
      const nextActiveReservationId = (nextActiveSnap.data() as { reservationId?: string } | undefined)?.reservationId;
      const currentKey = reservation.schoolName
        ? activeReservationKey(reservation.name, reservation.schoolName, reservation.phoneLast4)
        : "";
      const nextKey = activeReservationKey(name, schoolName, phoneLast4);

      if (nextActiveSnap.exists && nextActiveReservationId !== reservationId) {
        throw new HttpsError("already-exists", "이미 예약된 정보가 있습니다.");
      }

      if (currentKey && currentKey !== nextKey) {
        shouldDeleteCurrentActiveRef = true;
      }

      if (!nextActiveSnap.exists) {
        shouldCreateNextActiveRef = true;
      }
    }

    const updates: Record<string, unknown> = {
      name,
      schoolName,
      phoneLast4,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (seatDisplayNames && reservation.status === "CONFIRMED") {
      const newSeatIds = seatDisplayNames.map((displayName) => {
        const seatId = displayNameToSeatId(displayName);
        if (!seatId) {
          throw new HttpsError("invalid-argument", "Seat display names must look like 1층 가0208.");
        }
        return seatId;
      });
      const unique = Array.from(new Set(newSeatIds));
      if (unique.length !== newSeatIds.length) {
        throw new HttpsError("invalid-argument", "Duplicate seats are not allowed.");
      }
      const currentSeatIds = reservationSeatIds(reservation);
      if (unique.length !== currentSeatIds.length) {
        throw new HttpsError("invalid-argument", "Seat count cannot be changed.");
      }

      const currentSet = new Set(currentSeatIds);
      const newDisplayNames: string[] = [];
      for (const newSeatId of unique) {
        const newSeatRef = db.collection("seats").doc(newSeatId);
        const newSeatSnap = await tx.get(newSeatRef);

        if (!newSeatSnap.exists) {
          throw new HttpsError("not-found", "Seat was not found.");
        }

        const newSeat = newSeatSnap.data() as { displayName: string; status: string };
        if (!currentSet.has(newSeatId) && newSeat.status !== "AVAILABLE") {
          throw new HttpsError("already-exists", "Seat is already reserved.");
        }
        newDisplayNames.push(newSeat.displayName);
      }

      await releaseSeatsInTransaction(
        tx,
        currentSeatIds.filter((seatId) => !unique.includes(seatId))
      );
      for (const newSeatId of unique) {
        tx.update(db.collection("seats").doc(newSeatId), {
          status: "RESERVED",
          reservationId,
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      updates.seatIds = unique;
      updates.seatDisplayNames = newDisplayNames;
      updates.seatCount = unique.length;
      updates.seatId = unique[0];
      updates.seatDisplayName = newDisplayNames.join(", ");
    }

    if (shouldDeleteCurrentActiveRef) {
      deleteActiveReservationKey(tx, reservation);
    }

    if (shouldCreateNextActiveRef && nextActiveRef) {
      tx.create(nextActiveRef, {
        reservationId,
        name,
        schoolName,
        phoneLast4,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    tx.update(reservationRef, updates);
    return mapAdminReservation(reservationId, {
      ...reservation,
      ...updates,
      name,
      schoolName,
      phoneLast4
    } as Reservation);
  });
});

export const adminResetAllReservations = onCall(callableOptions, async (request) => {
  await assertAdmin(request.auth?.uid, adminFlag(request));

  const reservationsSnap = await db.collection("reservations").where("status", "==", "CONFIRMED").get();
  const seatsSnap = await db.collection("seats").where("status", "==", "RESERVED").get();
  const activeKeysSnap = await db.collection("activeReservationKeys").get();

  const batchState = { batch: db.batch(), count: 0 };
  let canceled = 0;
  let released = 0;

  for (const doc of reservationsSnap.docs) {
    batchState.batch.update(doc.ref, {
      status: "CANCELED",
      canceledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    batchState.count += 1;
    canceled += 1;
    await commitBatch(batchState);
  }

  for (const doc of seatsSnap.docs) {
    batchState.batch.update(doc.ref, {
      status: "AVAILABLE",
      reservationId: null,
      updatedAt: FieldValue.serverTimestamp()
    });
    batchState.count += 1;
    released += 1;
    await commitBatch(batchState);
  }

  for (const doc of activeKeysSnap.docs) {
    batchState.batch.delete(doc.ref);
    batchState.count += 1;
    await commitBatch(batchState);
  }

  await commitBatch(batchState, true);
  await ensureSeatsReady();
  return { canceled, released };
});

export const seedSeats = onCall(callableOptions, async (request) => {
  await assertAdmin(request.auth?.uid, adminFlag(request));
  return ensureSeatsReady();
});
